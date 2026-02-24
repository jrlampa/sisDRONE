import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';
import type { Pole, AnalysisResult } from '../types';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 1,
  role: 'assistant',
  content: 'Olá! Sou seu assistente SisDRONE. Posso ajudar com análises, orçamentos e dados técnicos.',
};

interface UseChatOptions {
  selectedPole: Pole | null;
  analysis: AnalysisResult | null;
}

export function useChat({ selectedPole, analysis }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const nextId = useRef(2);

  const clearChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
    nextId.current = 2;
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: nextId.current++, role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.chatWithAI(userMsg.content, { pole: selectedPole, analysis });
      const aiMsg: ChatMessage = { id: nextId.current++, role: 'assistant', content: res.data.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: nextId.current++, role: 'assistant', content: 'Desculpe, estou com problemas de conexão.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, selectedPole, analysis]);

  return { messages, input, setInput, loading, handleSend, clearChat };
}
