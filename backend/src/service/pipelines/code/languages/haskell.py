HASKELL_QUERIES = {
    "functions": """
        (function) @function_node
        (bind
            name: (variable) @bind_name) @bind_node
    """,
    "classes": """
        (class) @class_node
        (data_type) @data_type_node
        (newtype) @newtype_node
        (type_synomym) @type_synonym_node
    """,
    "imports": """
        (import) @import
    """,
    "calls": """
        (apply
            function: (variable) @callee) @apply_node
    """,
    # Polymorphic parameters use `variable` under type `function`, not a separate `type_variable` kind
    # in tree-sitter-haskell; keep variables to top-level/type signatures only.
    "variables": """
        (signature
            name: (variable) @name) @signature_node
    """,
}
