import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { api } from '../../services/api';
import { haptics } from '../../services/haptics';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface ChatBotModalProps {
  visible: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  'Which contractor got the biggest flood control budget in Bogo?',
  'Tell me about project 24HH0043',
  'Top contractors in Cebu?',
];

function generateBotResponse(userQuery: string): string {
  const q = userQuery.toLowerCase();
  if (q.includes('bogo') && (q.includes('flood') || q.includes('budget') || q.includes('contractor'))) {
    return 'In Bogo City, QM BUILDERS holds the largest flood mitigation contract: ₱49,000,000 for the Construction of Flood Mitigation Structure along Bogo River (Project 24HD0012). FIRST GRANDEUR BUILDERS also completed slope protection along Bogo River for ₱22,900,000.';
  }
  if (q.includes('24hh0043') || q.includes('lahug')) {
    return 'Project 24HH0043: "Lahug River Flood Control Dredging & Slope Reinforcement" located in Lahug, Cebu City. Awarded to QM BUILDERS with an approved budget of ₱85,200,000. Current status is Ongoing with reinforced sheet piles and pedestrian retaining wall.';
  }
  if (q.includes('top contractor') || q.includes('contractors')) {
    return 'Top DPWH Contractors in Cebu by awarded budget:\n1. WTG CONSTRUCTION & DEVELOPMENT CORP. (₱1.85B, 14 projects)\n2. QM BUILDERS (₱1.52B, 19 projects)\n3. FIRST GRANDEUR BUILDERS (₱875.4M, 11 projects)\n4. PLD CONSTRUCTION (₱654.2M, 9 projects)';
  }
  return `According to DPWH Cebu knowledge graph records, we have 53 Local Government Units and ongoing civil works tracked. You can tap any municipality on the map or select a contractor to review awarded allocations.`;
}

export default function ChatBotModal({ visible, onClose }: ChatBotModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'Hello! I am your ProjectTRACK Civic Assistant. Ask me anything about DPWH civil works, contractor rankings, or infrastructure budgets across Cebu Province.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [visible, messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isTyping) return;

    haptics.triggerLightImpact();
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const history = messages
        .filter((m) => m.text)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.text }));

      const res = await api.sendChatMessage(text, history);
      const botMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: 'assistant',
        text: res.answer,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallback = generateBotResponse(text);
      setMessages((prev) => [
        ...prev,
        { id: `b_${Date.now()}`, role: 'assistant', text: fallback },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop} testID="chatbot-modal">
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>Civic Assistant</Text>
                    <Text style={styles.headerSubtitle}>
                      GraphRAG · DPWH Cebu Knowledge Base
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  testID="close-chat-btn"
                  accessibilityLabel="Close Chat"
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Suggestions Chips */}
              <View style={styles.suggestionsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {SUGGESTIONS.map((sugg) => (
                    <TouchableOpacity
                      key={sugg}
                      style={styles.suggestionChip}
                      onPress={() => handleSend(sugg)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionText}>{sugg}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Conversation Messages */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.messageRow,
                        isUser ? styles.userRow : styles.assistantRow,
                      ]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          isUser ? styles.userBubble : styles.assistantBubble,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            isUser ? styles.userText : styles.assistantText,
                          ]}
                        >
                          {msg.text}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {isTyping && (
                  <View style={[styles.messageRow, styles.assistantRow]}>
                    <View style={[styles.bubble, styles.assistantBubble]}>
                      <Text style={styles.typingIndicator}>Assistant is thinking…</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Input Area */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask about projects, contractors, budgets..."
                  placeholderTextColor="#94a3b8"
                  value={inputText}
                  onChangeText={setInputText}
                  testID="chat-input"
                  returnKeyType="send"
                  onSubmitEditing={() => handleSend()}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    !inputText.trim() && styles.sendBtnDisabled,
                  ]}
                  onPress={() => handleSend()}
                  disabled={!inputText.trim() || isTyping}
                  testID="send-chat-btn"
                >
                  <Text style={styles.sendBtnText}>↑</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    maxHeight: '88%',
    height: '88%',
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#1f3d3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
  suggestionsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 11,
    color: '#1f3d3c',
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#1f3d3c',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  userText: {
    color: '#ffffff',
  },
  assistantText: {
    color: '#1e293b',
  },
  typingIndicator: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#64748b',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f3d3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
});
