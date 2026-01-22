/**
 * OpenAI service adapter for streaming church-affiliation lookups. Builds a focused prompt with
 * name/location/domain hints, calls the Responses API with web search, and yields incremental
 * text deltas plus any cited source URLs. This stays at the services layer—no orchestration or DB
 * writes—so callers can plug it into higher-level flows.
 */

export interface ChurchSearchParams {
  fullName: string
  city?: string
  state?: string
  country?: string
  emailDomain?: string
}

export interface SearchSource {
  url: string
  title?: string
}

export interface ChurchSearchStreamChunk {
  type: 'delta' | 'sources' | 'error' | 'done'
  content?: string
  sources?: SearchSource[]
  error?: string
}

/**
 * Search for church affiliation using OpenAI with web search
 * Returns an async generator that yields response chunks
 */
export async function* searchChurchAffiliation(
  params: ChurchSearchParams,
  apiKey: string
): AsyncGenerator<ChurchSearchStreamChunk> {
  try {
    // Build the prompt with available information
    const locationParts = [params.city, params.state, params.country].filter(Boolean)
    const location = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown'
    
    const input = `Please search the internet to find out whether this person is part of a church.

Person Details:
- Full Name: ${params.fullName}
- Location: ${location}
${params.emailDomain ? `- Website Domain: ${params.emailDomain} (this is a website domain, not just an email domain - try visiting https://${params.emailDomain} or www.${params.emailDomain})` : ''}

Please provide information about:
1. Whether this person appears to be affiliated with a church
2. Which church they might be associated with
3. Any relevant details about their role or involvement

IMPORTANT SEARCH INSTRUCTIONS:
${params.emailDomain ? `- The domain "${params.emailDomain}" is a WEBSITE domain. Try searching for:
  * "https://${params.emailDomain}" or "www.${params.emailDomain}"
  * "site:${params.emailDomain}" to find pages on that website
  * The name of the organization that owns ${params.emailDomain}
  * "${params.fullName}" AND "${params.emailDomain}" together
- FIRST identify what church or organization operates the website ${params.emailDomain}
- Then look for ${params.fullName}'s connection to that specific organization
` : ''}
- Only report affiliations that you can verify with specific evidence
- Be very careful with domain names - do NOT assume similar domains are the same organization
- If you cannot find information about the website domain or this person, clearly state that
- Do not make assumptions based on partial matches or similar-sounding names

Be concise and focus on factual information found through web searches.`

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        tools: [
          {
            type: 'web_search_preview'
          }
        ],
        input: input,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      yield {
        type: 'error',
        error: error.error?.message || `OpenAI API error: ${response.status}`
      }
      return
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      yield { type: 'error', error: 'Failed to get response stream' }
      return
    }

    let buffer = ''
    let collectedSources: SearchSource[] = []

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim() === '' || line.trim() === 'data: [DONE]') continue
        
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6))
            
            // Handle text deltas from message content
            if (json.type === 'response.output_item.added' || json.type === 'response.output_item.done') {
              const item = json.item || json.output_item
              
              if (item?.type === 'message' && item.content) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && contentItem.text) {
                    // Yield the text content
                    yield {
                      type: 'delta',
                      content: contentItem.text
                    }
                    
                    // Extract sources from annotations
                    if (contentItem.annotations && contentItem.annotations.length > 0) {
                      const sources = contentItem.annotations
                        .filter((ann: any) => ann.type === 'url_citation')
                        .map((ann: any) => ({
                          url: ann.url,
                          title: ann.title
                        }))
                      
                      if (sources.length > 0) {
                        collectedSources = sources
                      }
                    }
                  }
                }
              }
            }
            
            // Handle streaming text deltas
            if (json.type === 'response.content.delta' && json.delta) {
              yield {
                type: 'delta',
                content: json.delta
              }
            }
          } catch (e) {
            console.error('Error parsing SSE line:', e)
          }
        }
      }
    }

    // Yield sources if we collected any
    if (collectedSources.length > 0) {
      yield {
        type: 'sources',
        sources: collectedSources
      }
    }

    yield { type: 'done' }

  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}
