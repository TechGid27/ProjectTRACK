import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ChatBotModal from '../src/ui/components/ChatBotModal';
import { api } from '../src/services/api';

describe('ChatBotModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectProject = jest.fn();
  const mockOnFocusLgu = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders chat assistant title and initial greeting', () => {
    const { getByText, getByPlaceholderText } = render(
      <ChatBotModal
        visible={true}
        onClose={mockOnClose}
        onSelectProject={mockOnSelectProject}
        onFocusLgu={mockOnFocusLgu}
      />,
    );

    expect(getByText('Civic Assistant')).toBeTruthy();
    expect(getByText(/DPWH Cebu Knowledge Base/i)).toBeTruthy();
    expect(getByPlaceholderText(/Ask about projects, contractors, budgets/i)).toBeTruthy();
  });

  test('detects LGU location query, calls onFocusLgu, and automatically closes the chat modal', async () => {
    const mockSendChat = jest.spyOn(api, 'sendChatMessage').mockResolvedValue({
      answer: 'DPWH has ongoing flood control projects in Bogo City.',
      mode: 'rag',
      spatial: {
        target_lgu: 'Bogo City',
      },
    });

    const { getByPlaceholderText, getByTestId } = render(
      <ChatBotModal
        visible={true}
        onClose={mockOnClose}
        onSelectProject={mockOnSelectProject}
        onFocusLgu={mockOnFocusLgu}
      />,
    );

    const input = getByPlaceholderText(/Ask about projects, contractors, budgets/i);
    fireEvent.changeText(input, 'Tell me about projects in Bogo City');

    const sendBtn = getByTestId('send-chat-btn');
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(mockOnFocusLgu).toHaveBeenCalledWith('Bogo City');
      expect(mockOnClose).toHaveBeenCalled();
    });

    mockSendChat.mockRestore();
  });
});
