"""Pytest configuration."""
import os
import pytest
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env.example"))


@pytest.fixture
def mock_page_details():
    """Mock page details for testing."""
    return {
        "title": "Test Page",
        "url": "https://example.com",
        "text": "This is a test page with sample content.",
        "forms": []
    }


@pytest.fixture
def mock_page_content():
    """Mock page content summary."""
    return "Test Page - https://example.com - This is a test page with sample content."


@pytest.fixture
def sample_history():
    """Sample conversation history."""
    return [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi! How can I help you?"}
    ]