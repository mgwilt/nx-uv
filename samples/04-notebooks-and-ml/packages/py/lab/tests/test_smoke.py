from lab import hello


def test_hello() -> None:
    assert hello().startswith("hello")
