DART_QUERIES = {
    "functions": """
        (function_signature
            name: (identifier) @name
            (formal_parameter_list) @params
        ) @function_node
        (constructor_signature
            name: (identifier) @name
            (formal_parameter_list) @params
        ) @function_node
    """,
    "classes": "(class_definition) @type_node",
    "mixins": "(mixin_declaration) @type_node",
    "extensions": "(extension_declaration) @type_node",
    "enums": "(enum_declaration) @type_node",
    "imports": """
        (library_import) @import
        (library_export) @import
    """,
    "calls": """
        (selector
            (argument_part (arguments))
        ) @call_selector
    """,
    "variables": """
        (local_variable_declaration
            (initialized_variable_definition
                name: (identifier) @name
            )
        ) @variable
        (declaration
            (initialized_identifier_list
                (initialized_identifier
                    (identifier) @name
                )
            )
        ) @variable
    """,
}

SIGNATURE_TYPES = (
    "function_signature",
    "method_signature",
    "getter_signature",
    "setter_signature",
    "constructor_signature",
    "factory_constructor_signature",
    "operator_signature",
)
CONTAINER_TYPES = (
    "class_definition",
    "mixin_declaration",
    "extension_declaration",
)
_CALL_PUNCTUATION = {".", "?.", "..", "?..", ";", ",", "(", ")", "[", "]"}
