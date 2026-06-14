from src.service.pipelines.code.languages.c import C_QUERIES
from src.service.pipelines.code.languages.cpp import CPP_QUERIES
from src.service.pipelines.code.languages.csharp import CSHARP_QUERIES
from src.service.pipelines.code.languages.dart import DART_QUERIES
from src.service.pipelines.code.languages.elisp import ELISP_QUERIES
from src.service.pipelines.code.languages.go import GO_QUERIES
from src.service.pipelines.code.languages.haskell import HASKELL_QUERIES
from src.service.pipelines.code.languages.java import JAVA_QUERIES
from src.service.pipelines.code.languages.kotlin import KOTLIN_QUERIES
from src.service.pipelines.code.languages.perl import PERL_QUERIES
from src.service.pipelines.code.languages.php import PHP_QUERIES
from src.service.pipelines.code.languages.python import PY_QUERIES
from src.service.pipelines.code.languages.ruby import RUBY_QUERIES
from src.service.pipelines.code.languages.rust import RUST_QUERIES
from src.service.pipelines.code.languages.scala import SCALA_QUERIES
from src.service.pipelines.code.languages.swift import SWIFT_QUERIES
from src.service.pipelines.code.languages.typescript import TS_QUERIES

LANUGUAGE_GRAMMERS = {
    "c": C_QUERIES,
    "cpp": CPP_QUERIES,
    "go": GO_QUERIES,
    "java": JAVA_QUERIES,
    "rust": RUST_QUERIES,
    "python": PY_QUERIES,
    "typescript": TS_QUERIES,
    "dart": DART_QUERIES,
    "php": PHP_QUERIES,
    "ruby": RUBY_QUERIES,
    "swift": SWIFT_QUERIES,
    "kotlin": KOTLIN_QUERIES,
    "perl": PERL_QUERIES,
    "csharp": CSHARP_QUERIES,
    "scala": SCALA_QUERIES,
    "haskell": HASKELL_QUERIES,
    "elisp": ELISP_QUERIES,
}
