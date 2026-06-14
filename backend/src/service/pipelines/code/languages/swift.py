SWIFT_QUERIES = {
    "functions": """
        [
            (function_declaration) @function_node
            (init_declaration) @init_node
        ]
    """,
    "classes": """
        [
            (class_declaration) @class_decl
            (protocol_declaration) @protocol
        ]
    """,
    "imports": """
        (import_declaration) @import
    """,
    "calls": """
        [
            (call_expression) @call_node
            (constructor_expression) @call_node
        ]
    """,
    "variables": """
        [
            (property_declaration) @variable
            (parameter) @variable
        ]
    """,
}
