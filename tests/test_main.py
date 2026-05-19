"""main.py の Mangum アダプタ存在確認テスト (task 1.3)"""

from backend.main import handler


def test_mangum_handler_is_defined():
    """Lambda エントリポイントとして handler が存在することを確認"""
    assert handler is not None


def test_mangum_handler_is_callable():
    assert callable(handler)
