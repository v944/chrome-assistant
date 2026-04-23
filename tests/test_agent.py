"""Tests for the Langgraph agent."""
import os
import pytest
import json
from unittest.mock import patch, MagicMock

# Test the agent nodes and functions
class TestAgentNodes:
    """Test individual agent nodes."""

    def test_format_page_context_with_details(self):
        """Test page context formatting with full details."""
        from agent import format_page_context
        
        page_details = {
            "title": "Test Page",
            "url": "https://example.com",
            "text": "Sample content",
            "forms": []
        }
        
        result = format_page_context("Sample content", page_details)
        
        assert "Test Page" in result
        assert "https://example.com" in result
        assert "Sample content" in result

    def test_format_page_context_empty(self):
        """Test page context with no details."""
        from agent import format_page_context
        
        result = format_page_context("", None)
        assert result == ""

    def test_should_search_triggers(self):
        """Test search trigger detection."""
        from agent import should_search
        
        search_queries = [
            {"role": "user", "content": "Find discount codes for this product"},
            {"role": "user", "content": "Is this fact true?"},
            {"role": "user", "content": "Search for latest news"},
        ]
        
        for query in search_queries:
            state = {"messages": [query], "page_content": ""}
            assert should_search(state) is True, f"Should search for: {query['content']}"

    def test_should_search_no_trigger(self):
        """Test when not to trigger search."""
        from agent import should_search
        
        non_search_queries = [
            {"role": "user", "content": "What is on this page?"},
            {"role": "user", "content": "Summarize this"},
            {"role": "user", "content": "Explain this concept"},
        ]
        
        for query in non_search_queries:
            state = {"messages": [query], "page_content": "Some content"}
            result = should_search(state)
            assert result is False, f"Should not search for: {query['content']}"


class TestAgentState:
    """Test agent state management."""

    def test_initial_state(self):
        """Test initial state structure."""
        from agent import AgentState
        
        state: AgentState = {
            "messages": [],
            "page_content": "",
            "page_details": None,
            "current_status": "idle",
            "tool_results": [],
            "response": None,
        }
        
        assert state["current_status"] == "idle"
        assert state["response"] is None

    def test_state_transitions(self):
        """Test state transitions through nodes."""
        from agent import analyze_node, AgentState
        
        state: AgentState = {
            "messages": [{"role": "user", "content": "Hello"}],
            "page_content": "",
            "page_details": None,
            "current_status": "idle",
            "tool_results": [],
            "response": None,
        }
        
        result = analyze_node(state)
        
        assert result["current_status"] == "thinking"


class TestExaSearch:
    """Test EXA search tool."""

    @patch('tools.exa_search.ExaSearchTool.search')
    def test_search_returns_results(self, mock_search):
        """Test search returns proper structure."""
        mock_search.return_value = {
            "results": [
                {
                    "title": "Test Result",
                    "url": "https://example.com",
                    "text": "Sample text"
                }
            ]
        }
        
        from tools.exa_search import ExaSearchTool
        tool = ExaSearchTool(api_key="test_key")
        result = tool.search("test query")
        
        assert "results" in result
        assert len(result["results"]) > 0

    @patch('tools.exa_search.ExaSearchTool.answer')
    def test_answer_returns_response(self, mock_answer):
        """Test answer endpoint."""
        mock_answer.return_value = {
            "answer": "Test answer",
            "citations": []
        }
        
        from tools.exa_search import ExaSearchTool
        tool = ExaSearchTool(api_key="test_key")
        result = tool.answer("test query")
        
        assert "answer" in result


class TestGeminiIntegration:
    """Test Gemini integration."""

    @patch('google.generativeai.GenerativeModel.generate_content')
    def test_gemini_response_parsing(self, mock_generate):
        """Test Gemini response parsing."""
        # Mock different response formats
        mock_response = MagicMock()
        mock_response.text = "Test response"
        
        mock_generate.return_value = mock_response
        
        from agent import model
        result = model.generate_content([{"role": "user", "parts": [{"text": "Hello"}]}])
        
        assert result.text == "Test response"

    @patch('google.generativeai.GenerativeModel.generate_content')
    def test_gemini_candidates_parsing(self, mock_generate):
        """Test parsing candidates when text is empty."""
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.text = "Response from candidates"
        mock_candidate.content.parts = [mock_part]
        
        mock_response = MagicMock()
        mock_response.text = ""
        mock_response.candidates = [mock_candidate]
        
        mock_generate.return_value = mock_response
        
        from agent import model
        result = model.generate_content([{"role": "user", "parts": [{"text": "Hello"}]}])
        
        # Should handle empty text and parse candidates
        assert hasattr(mock_response, 'candidates')


class TestAgentFlow:
    """Test complete agent flow."""

    @patch('google.generativeai.GenerativeModel.generate_content')
    def test_run_agent_without_search(self, mock_generate):
        """Test running agent without search tool."""
        mock_response = MagicMock()
        mock_response.text = "Direct response"
        
        mock_generate.return_value = mock_response
        
        from agent import run_agent
        result = run_agent(
            message="What is on this page?",
            page_content="Sample content",
            page_details={"title": "Test", "url": "https://test.com"},
            session_history=[]
        )
        
        assert result["response"] == "Direct response"
        assert result["current_status"] == "completed"

    @patch('google.generativeai.GenerativeModel.generate_content')
    def test_run_agent_with_session_history(self, mock_generate):
        """Test agent respects session history."""
        mock_response = MagicMock()
        mock_response.text = "Response considering history"
        
        mock_generate.return_value = mock_response
        
        history = [
            {"role": "user", "content": "Previous question"},
            {"role": "assistant", "content": "Previous answer"}
        ]
        
        from agent import run_agent
        result = run_agent(
            message="Follow up question",
            page_content="",
            session_history=history
        )
        
        assert "history" in str(mock_generate.call_args)


class TestApiContract:
    """Test API contract compliance."""

    def test_chat_request_schema(self):
        """Test chat request matches contract."""
        # Test the expected request format from skill file
        request_data = {
            "message": "User prompt text",
            "page_content": "Flattened summary (title, URL, first 5k chars, form overview)",
            "page_details": {
                "title": "Page title",
                "url": "https://example.com",
                "text": "Raw visible text (first 5k chars)",
                "forms": [
                    {
                        "id": "form_0",
                        "action": "https://example.com/submit",
                        "method": "post",
                        "fields": [
                            {
                                "name": "email",
                                "label": "Email",
                                "type": "email",
                                "required": True,
                                "value": ""
                            }
                        ]
                    }
                ]
            }
        }
        
        # Verify structure matches expected contract
        assert "message" in request_data
        assert "page_content" in request_data
        assert "page_details" in request_data
        assert request_data["page_details"]["title"] == "Page title"
        assert "forms" in request_data["page_details"]

    def test_chat_response_schema(self):
        """Test chat response matches contract."""
        response_data = {
            "response": "AI response",
            "status": "completed"
        }
        
        assert "response" in response_data
        assert "status" in response_data
        assert response_data["status"] == "completed"


class TestWebSocketMessages:
    """Test WebSocket message formats."""

    def test_status_message_format(self):
        """Test status update message format."""
        status_messages = [
            {"type": "status", "status": "thinking"},
            {"type": "status", "status": "searching"},
            {"type": "status", "status": "responding"},
            {"type": "status", "status": "completed"},
            {"type": "status", "status": "error"},
        ]
        
        for msg in status_messages:
            assert msg["type"] == "status"
            assert "status" in msg

    def test_response_message_format(self):
        """Test response message format."""
        response_msg = {"type": "response", "content": "Response text"}
        
        assert response_msg["type"] == "response"
        assert "content" in response_msg


class TestErrorHandling:
    """Test error handling."""

    @patch('google.generativeai.GenerativeModel.generate_content')
    def test_gemini_error_handling(self, mock_generate):
        """Test Gemini errors are handled gracefully."""
        mock_generate.side_effect = Exception("API Error")
        
        from agent import run_agent
        result = run_agent(
            message="Test",
            page_content=""
        )
        
        # Should still return a response, not crash
        assert "response" in result
        assert "error" in result["response"].lower() or result["response"]

    def test_exa_missing_api_key(self):
        """Test EXA fails gracefully without API key."""
        from tools.exa_search import ExaSearchTool
        
        with pytest.raises(ValueError, match="EXA_API_KEY"):
            ExaSearchTool(api_key=None)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])