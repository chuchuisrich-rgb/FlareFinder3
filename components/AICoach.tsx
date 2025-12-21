
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { chatWithCoach } from '../services/geminiService';
import { ChatMessage } from '../types';
import { Send, User, Bot, Loader2, Sparkles, ExternalLink, Utensils, ShoppingBag, ArrowRight } from 'lucide-react';

export const AICoach: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial greeting or history
    setMessages([
      {
        id: '1',
        role: 'model',
        text: 'Hello! I’m your Bio-Twin Neural Interface. I have access to your labs, logs, and marketplace. How can I optimize your biology today?',
        timestamp: new Date().toISOString()
      }
    ]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const state = db.getState();
      // Call updated service expecting rich content
      const response = await chatWithCoach(userMsg.text, state);
      
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: response.reply,
        timestamp: new Date().toISOString(),
        suggestions: response.suggestions,
        // @ts-ignore - Assuming service returns this, matching type definition
        richContent: response.richContent
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  const renderRichContent = (content: any) => {
      if (!content) return null;
      
      const { type, data } = content;
      
      if (type === 'product') {
          return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3 mb-2 max-w-sm">
                  <div className="flex items-start gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                          <ShoppingBag className="w-6 h-6 text-indigo-500" />
                      </div>
                      <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-sm">{data.title}</h4>
                          <p className="text-xs text-slate-500 mb-2">{data.subtitle}</p>
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{data.matchScore}% Match</span>
                          </div>
                      </div>
                  </div>
                  <button className="w-full mt-3 bg-slate-900 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800">
                      View Product <ExternalLink className="w-3 h-3" />
                  </button>
              </div>
          );
      }
      
      if (type === 'recipe') {
          return (
              <div className="bg-white border border-teal-100 rounded-xl p-4 mt-3 mb-2 max-w-sm shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                      <Utensils className="w-4 h-4 text-teal-500" />
                      <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Chef AI Recommendation</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">{data.title}</h4>
                  <p className="text-xs text-slate-500 mb-3">{data.subtitle}</p>
                  <button className="w-full border border-teal-200 text-teal-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-teal-50">
                      View Recipe <ArrowRight className="w-3 h-3" />
                  </button>
              </div>
          );
      }
      
      if (type === 'action') {
          return (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mt-3 mb-2 max-w-sm flex items-center justify-between">
                  <div>
                      <h4 className="font-bold text-indigo-900 text-sm">{data.title}</h4>
                      <p className="text-xs text-indigo-700">{data.subtitle}</p>
                  </div>
                  <button className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700">
                      {data.actionLabel || "Do it"}
                  </button>
              </div>
          );
      }
      
      return null;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-slate-900 p-4 text-white flex items-center gap-3">
        <div className="bg-teal-500 p-2 rounded-full relative">
          <Sparkles className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-900"></span>
        </div>
        <div>
           <h2 className="font-bold text-lg">Neural Interface</h2>
           <p className="text-slate-400 text-xs">Bio-Twin Active • Listening</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-300' : 'bg-teal-600'}`}>
                        {msg.role === 'user' ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-white text-slate-800 rounded-br-none border border-slate-100' 
                        : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'
                    }`}>
                        {msg.text}
                    </div>
                </div>
                
                {/* Rich Content Card */}
                {msg.richContent && renderRichContent(msg.richContent)}
                
                {/* Suggestions Pills */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 ml-10">
                        {msg.suggestions.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => handleSend(s)}
                                className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-600 hover:border-teal-400 hover:text-teal-600 transition-colors shadow-sm"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex justify-start">
             <div className="flex items-end max-w-[80%] gap-2">
               <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
               </div>
               <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm">
                 <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
               </div>
             </div>
           </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything (e.g. 'Find safe snacks')..."
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="bg-slate-900 text-white p-3 rounded-xl disabled:opacity-50 hover:bg-slate-800 transition-colors shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
