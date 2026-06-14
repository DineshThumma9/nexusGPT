HTML_QUERIES = {
    "tags": """
        (element
            (start_tag
                (tag_name) @tag_name
            )
        ) @tag_node
    """,
    "attributes": """
        (attribute
            (attribute_name) @attr_name
            (quoted_attribute_value (attribute_value) @attr_value)
        ) @attr_node
    """,
    "scripts": """
        (script_element) @script
    """,
    "links": """
        (link_element) @link
    """,
}
