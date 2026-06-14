"""Parse java files to extract SCIP graph data."""

JAVA_QUERIES = {
    "symbols": """
        (class_declaration
            name: (identifier) @name
        ) @class_node

        (interface_declaration
            name: (identifier) @name
        ) @interface_node

        (enum_declaration
            name: (identifier) @name
        ) @enum_node

        (method_declaration
            name: (identifier) @name
        ) @method_node

        (constructor_declaration
            name: (identifier) @name
        ) @method_node
    """,
    "variables": """
        (local_variable_declaration
            declarator: (variable_declarator
                name: (identifier) @name
            )
        ) @variable
        
        (field_declaration
            declarator: (variable_declarator
                name: (identifier) @name
            )
        ) @variable
    """,
    "calls": """
        (method_invocation
            name: (identifier) @name
        ) @call_node
        
        (object_creation_expression
            type: [
                (type_identifier)
                (scoped_type_identifier)
                (generic_type)
            ] @name
        ) @call_node
    """,
}

SIGNATURE_TYPES = (
    "method_declaration",
    "constructor_declaration",
)

CONTAINER_TYPES = (
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
)

_CALL_PUNCTUATION = {".", "::", "(", ")", "[", "]", ";", ","}
