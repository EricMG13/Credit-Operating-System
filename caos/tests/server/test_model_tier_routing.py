"""Model id → provider routing (engine/llm_client._provider).

The mode→tier→model chain (engine/presets) is covered in test_presets; this
guards the last hop — which API a resolved model id is dispatched to. A wrong
branch here sends a credit lane to the wrong provider (or none), so it earns a
check. The tier id alone decides routing — no separate provider flag.
"""

from engine.llm_client import _provider


def test_provider_routing_by_model_id():
    # Slash-ids and the deepseek/openrouter prefixes route to OpenRouter; gemini-*
    # to Gemini; everything else (incl. None) to Anthropic.
    assert _provider("deepseek/deepseek-v4-pro") == "openrouter"
    assert _provider("deepseek/deepseek-v4-flash") == "openrouter"
    assert _provider("z-ai/glm-5.2") == "openrouter"
    assert _provider("gemini-2.5-flash") == "gemini"
    assert _provider("gemini-2.5-flash-lite") == "gemini"
    assert _provider("claude-opus-4-8") == "anthropic"
    assert _provider("claude-sonnet-4-6") == "anthropic"
    assert _provider(None) == "anthropic"
    assert _provider("") == "anthropic"
