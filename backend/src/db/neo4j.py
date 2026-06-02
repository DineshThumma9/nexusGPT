from langchain_neo4j import Neo4jGraph

from src.config.settings import settings

_graph = None


def init_graph(force_reconnect=False):
    global _graph
    if _graph is None or force_reconnect:
        _graph = Neo4jGraph(
            url=settings.neo4j_url,
            username=settings.neo4j_user,
            password=settings.neo4j_password,
            database=settings.neo4j_database,
            driver_config={
                "max_connection_lifetime": 200,
                "keep_alive": True,
            },
        )
    return _graph


def get_graph():
    global _graph
    if _graph is None:
        init_graph()
    return _graph


def close_graph():
    global _graph
    if _graph is not None:
        _graph.close()
        _graph = None
