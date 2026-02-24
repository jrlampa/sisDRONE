import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Send, Bot, User as UserIcon, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import type { Pole, AnalysisResult } from '../types';

interface ChatAssistantProps {
  selectedPole: Pole | null;
  analysis: AnalysisResult | null;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ selectedPole, analysis }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, setInput, loading, handleSend, clearChat } = useChat({ selectedPole, analysis });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  if (!isOpen) {
    return (
      <button
        className="fixed bottom-6 right-6 btn-primary p-4 rounded-full shadow-lg z-50 animate-bounce-in"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir Chat"
        title="Abrir Chat"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-glass border-glass rounded-lg shadow-2xl z-50 flex flex-col transition-all duration-300 ${isExpanded ? 'w-[600px] h-[80vh]' : 'w-[350px] h-[500px]'}`}>

      {/* Header */}
      <div className="p-4 border-b border-light/10 flex justify-between items-center bg-primary/20 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-accent" />
          <h3 className="font-bold text-light">SisDRONE Chat</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={clearChat} className="p-1 hover:text-accent" aria-label="Limpar conversa" title="Limpar conversa">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:text-accent" aria-label={isExpanded ? "Restaurar" : "Expandir"} title={isExpanded ? "Restaurar" : "Expandir"}>
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:text-red-400" aria-label="Fechar Chat" title="Fechar Chat">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-darker text-gray-200 rounded-bl-none'}`}>
              <div className="flex items-center gap-2 mb-1 opacity-50 text-xs">
                {msg.role === 'user' ? <UserIcon size={10} /> : <Bot size={10} />}
                {msg.role === 'user' ? 'Você' : 'IA'}
              </div>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-darker p-3 rounded-lg rounded-bl-none flex gap-1">
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce delay-100" />
              <span className="w-2 h-2 bg-accent rounded-full animate-bounce delay-200" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-light/10 bg-darker/50 rounded-b-lg flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Digite sua pergunta..."
          className="flex-1 bg-transparent border-none outline-none text-light text-sm"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="p-2 text-accent disabled:opacity-50 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Enviar Mensagem"
          title="Enviar Mensagem"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatAssistant;
