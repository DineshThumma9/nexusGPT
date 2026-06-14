RUBY_QUERIES = {
    "functions": """
        (method
            name: (identifier) @name
        ) @function_node
    """,
    "classes": """
        (class
            name: (constant) @name
        ) @class
    """,
    "modules": """
        (module
            name: (constant) @name
        ) @module_node
    """,
    "imports": """
        (call
            method: (identifier) @method_name
            arguments: (argument_list
                (string) @path
            )
        ) @import
    """,
    "calls": """
        (call
            receiver: (_)? @receiver
            method: (identifier) @name
            arguments: (argument_list)? @args
        ) @call_node
    """,
    "variables": """
        (assignment
            left: (identifier) @name
            right: (_) @value
        )
        (assignment
            left: (instance_variable) @name
            right: (_) @value
        )
    """,
    "comments": """
        (comment) @comment
    """,
    "module_includes": """
        (call
          method: (identifier) @method
          arguments: (argument_list (constant) @module)
        ) @include_call
    """,
}
