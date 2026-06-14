"""Parse build.gradle / build.gradle.kts files to extract Gradle build graph data (#888)."""

import re

# Matches: implementation("group:artifact:version") or compile 'g:a:v'
_DEP_PATTERN = re.compile(
    r"""(?:implementation|api|compile|testImplementation|runtimeOnly|compileOnly|testRuntimeOnly|annotationProcessor)\s*[\('"]([\w.\-]+):([\w.\-]+):?([\w.\-]*)['"\)]""",
    re.MULTILINE,
)

# Matches: project(':module-name') or project(":module-name")
_PROJECT_DEP_PATTERN = re.compile(r"""project\(['"]:([\w.\-/]+)['"]\)""")

# Matches: rootProject.name = "name" or settings include(':module')
_SETTINGS_INCLUDE_PATTERN = re.compile(r"""include\(['"]:([\w.\-/]+)['"]\)""")

# configuration keyword for inter-module deps
_CONFIG_PREFIX_PATTERN = re.compile(
    r"""^(implementation|api|compile|testImplementation|runtimeOnly|compileOnly)\s+project""",
    re.MULTILINE,
)
