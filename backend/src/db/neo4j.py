import os

from dotenv import load_dotenv
from langchain_neo4j import Neo4jGraph

load_dotenv()

_graph = None


def get_graph(force_reconnect=False):
    global _graph
    if _graph is None or force_reconnect:
        _graph = Neo4jGraph(
            url=os.getenv("NEO4J_URL"),
            username=os.getenv("NEO4J_USER"),
            password=os.getenv("NEO4J_PASSWORD"),
            database=os.getenv("NEO4J_DATABASE"),
            driver_config={
                "max_connection_lifetime": 200,
                "keep_alive": True,
            },
        )
    return _graph


# graph_chain can be initialized dynamically when an LLM is available
