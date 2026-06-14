CSHARP_QUERIES = {
    "functions": """
        (method_declaration
            name: (identifier) @name
            parameters: (parameter_list) @params
        ) @function_node
        
        (constructor_declaration
            name: (identifier) @name
            parameters: (parameter_list) @params
        ) @function_node
        
        (local_function_statement
            name: (identifier) @name
            parameters: (parameter_list) @params
        ) @function_node
    """,
    "classes": """
        (class_declaration 
            name: (identifier) @name
            (base_list)? @bases
        ) @class
    """,
    "interfaces": """
        (interface_declaration 
            name: (identifier) @name
            (base_list)? @bases
        ) @interface
    """,
    "structs": """
        (struct_declaration 
            name: (identifier) @name
            (base_list)? @bases
        ) @struct
    """,
    "enums": """
        (enum_declaration 
            name: (identifier) @name
        ) @enum
    """,
    "records": """
        (record_declaration 
            name: (identifier) @name
            (base_list)? @bases
        ) @record
    """,
    "properties": """
        (property_declaration
            name: (identifier) @name
        ) @property
    """,
    "imports": """
        (using_directive) @import
    """,
    "calls": """
        (invocation_expression
            function: [
                (identifier) @name
                (member_access_expression
                    name: (identifier) @name
                ) @full_name
            ]
        )
        
        (object_creation_expression
            type: [
                (identifier) @name
                (qualified_name) @name
            ]
        )
    """,
}
