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
  onSelectProject?: (projectId: string) => void;
  onFocusLgu?: (lguName: string) => void;
}

const SUGGESTIONS = [
  'Which contractor got the biggest flood control budget in Bogo?',
  'Tell me about project 24HH0043',
  'Top contractors in Cebu?',
];

const PROJECT_ID_REGEX = /\b(\d{2}[A-Za-z]{1,2}\d{4,5})\b/g;

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
  return 'According to DPWH Cebu knowledge graph records, we have 53 Local Government Units and ongoing civil works tracked. You can tap any municipality on the map or select a contractor to review awarded allocations.';
}

export default function ChatBotModal({
  visible,
  onClose,
  onSelectProject,
  onFocusLgu,
}: ChatBotModalProps) {
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

  const handleChipPress = (pid: string) => {
    haptics.triggerLightImpact();
    if (onSelectProject) {
      onSelectProject(pid);
      onClose();
    }
  };

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

      // Spatial camera navigation integration
      if (res.spatial?.target_lgu && onFocusLgu) {
        onFocusLgu(res.spatial.target_lgu);
      }
      if (res.spatial?.focused_project_id && onSelectProject) {
        onSelectProject(res.spatial.focused_project_id);
      }
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

  const renderBubbleContent = (text: string, isUser: boolean) => {
    if (isUser) {
      return (
        <Text style={[styles.bubbleText, styles.userText]}>
          {text}
        </Text>
      );
    }

    // Extract project IDs for interactive chips
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    PROJECT_ID_REGEX.lastIndex = 0;

    while ((match = PROJECT_ID_REGEX.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > lastIdx) {
        parts.push(
          <Text key={`txt-${lastIdx}`} style={[styles.bubbleText, styles.assistantText]}>
            {text.slice(lastIdx, start)}
          </Text>
        );
      }
      const pid = match[1].toUpperCase();
      parts.push(
        <TouchableOpacity
          key={`chip-${pid}-${start}`}
          style={styles.inlineChip}
          onPress={() => handleChipPress(pid)}
          activeOpacity={0.7}
        >
          <Text style={styles.inlineChipText}>📍 {pid}</Text>
        </TouchableOpacity>
      );
      lastIdx = end;
    }

    if (lastIdx < text.length) {
      parts.push(
        <Text key={`txt-${lastIdx}`} style={[styles.bubbleText, styles.assistantText]}>
          {text.slice(lastIdx)}
        </Text>
      );
    }

    return <View style={styles.assistantTextWrap}>{parts}</View>;
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
                        {renderBubbleContent(msg.text, isUser)}
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
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f3d3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBadgeText: {
    color: '#2dd4bf',
    fontSize: 12,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  suggestionsContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  suggestionChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
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
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
  },
  assistantText: {
    color: '#1e293b',
  },
  assistantTextWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inlineChip: {
    backgroundColor: '#ccfbf1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
    marginVertical: 1,
    borderWidth: 1,
    borderColor: '#5eead4',
  },
  inlineChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  typingIndicator: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    maxHeight: 80,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f3d3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
});
