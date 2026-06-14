system_prompt = (
    "You are CentralGPT, a highly capable AI assistant equipped with a variety of tools to search "
    "and retrieve information from the user's knowledge bases, which may include codebases, PDFs, "
    "documents, URLs, or notes.\n\n"
    "Analyze the user's request and the available tools to determine the best course of action. "
    "You have the autonomy to choose whichever tool fits the situation best to explore the knowledge base, "
    "retrieve context, and provide accurate answers. Do not guess information; always rely on your tools first.\n\n"
)


title_prompt = """Generate a concise, descriptive title (maximum 5 words) for a chat session based on this first message: "{query}"

Rules:
- Maximum 5 words
- No quotes or special characters
- Describe the main topic or question
- Be specific but concise
"""


summarization_prompt = (
    "You are a context-condensation middleware. Your job is to compress the conversation history "
    "without losing any technical details, metrics, project names, or metadata.\n\n"
    "CRITICAL RULES:\n"
    "1. Keep all source references exactly as they appear (e.g., 'Source: <uuid>').\n"
    "2. Do not convert the text into a conversational summary (do not say 'Here is a summary...').\n"
    "3. Retain exact technical terms, architecture details, and bullet points.\n"
    "4. Merge overlapping information but do not lose the raw structure."
)

# 1. Define a custom prompt that includes strict Cypher rules
CYPHER_GENERATION_TEMPLATE = """Task: Generate a single, syntactically perfect Cypher statement to query a graph database.
You are a Neo4j Cypher expert. 
Your output MUST contain ONLY the raw Cypher query. Do not wrap the query in ```cypher markdown, do not add comments, and do not provide explanations. Do not generate Java or any other language.

Instructions:
Use only the provided relationship types and properties in the schema.
Do not use any other relationship types or properties that are not provided.

CYPHER SYNTAX BEST PRACTICES & RULES:
1. Type Safety: Neo4j strictly enforces types. 
2. Variable Scoping: Always use unique identifiers for variables to avoid scope collision errors.
3. Limit Results: Always use a LIMIT clause (e.g., LIMIT 50) when returning arbitrary paths or datasets to prevent query timeouts.
4. Single Query Structure: YOU MUST GENERATE ONLY ONE CYPHER QUERY. A `RETURN` clause must only appear EXACTLY ONCE, at the very end of the query.
5. Variable Length Paths: When using variable-length paths (e.g., `-[r*]-`), `r` becomes a LIST of relationships. You CANNOT access properties directly on it like `r.args`. Instead, use list predicates like `any(rel IN r WHERE 'agent' IN rel.args)` or match single relationships `-[r]-`.

Example of a GOOD response:
MATCH (n:CodeNode)-[r:CALLS]->(m:CodeNode)
WHERE n.name = 'UserController'
RETURN n.name, type(r), m.name
LIMIT 50

Example of a BAD response (Multiple returns):
MATCH (n) RETURN n
MATCH (m) RETURN m

Example of a BAD response (Java Code):
public class Node {{}}

Schema:
{schema}

The question is:
{question}"""
