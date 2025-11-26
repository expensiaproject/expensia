import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  Receipt,
  FileText,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, getCategoryLabel } from '../components/shared/CategoryHelpers';

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['myExpenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ employeeId: user?.id }, '-date', 500),
    enabled: !!user?.id,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['myReports', user?.id],
    queryFn: () => base44.entities.Report.filter({ employeeId: user?.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const isAdmin = user?.role === 'admin';
  const baseCurrency = 'USD';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestedQuestions = [
    "Show my expenses this week",
    "How much did I spend on Air Tickets last month?",
    "What's my total spending by category?",
    "List my pending reimbursements",
  ];

  const handleSend = async (question = input) => {
    if (!question.trim()) return;

    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Build context for the AI
    const expensesSummary = expenses.slice(0, 100).map(e => ({
      date: e.date,
      merchant: e.merchant,
      category: getCategoryLabel(e.category),
      amount: e.amount,
      currency: e.currency || baseCurrency,
      status: e.status
    }));

    const reportsSummary = reports.slice(0, 20).map(r => ({
      title: r.title,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      total: r.totalAmount,
      status: r.status
    }));

    const prompt = `You are Expensia Assistant, an AI helper for expense management.

User: ${user?.full_name || 'Unknown'} (${user?.email})
Role: ${user?.role || 'user'}
Base Currency: ${baseCurrency}
Today: ${format(new Date(), 'yyyy-MM-dd')}

User's recent expenses (up to 100):
${JSON.stringify(expensesSummary, null, 2)}

User's reports (up to 20):
${JSON.stringify(reportsSummary, null, 2)}

User question: ${question}

Instructions:
- Answer the user's question based on their expense data
- Be helpful and concise
- Format currency amounts properly
- If calculating totals, show the breakdown
- If the user asks about data you don't have, let them know
- For date-related queries, use today's date as reference
- Don't make up data that doesn't exist in the provided context`;

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            }
          }
        }
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.answer,
        data: response.data
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expensia Assistant</h1>
            <p className="text-gray-500">Ask me anything about your expenses</p>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-sm h-[calc(100%-8rem)] flex flex-col">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-indigo-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                How can I help you today?
              </h2>
              <p className="text-gray-500 mb-6 max-w-md">
                I can help you analyze your expenses, find specific transactions, calculate totals, and more.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="p-3 text-left rounded-xl bg-gray-50 hover:bg-indigo-50 transition-colors text-sm text-gray-700 hover:text-indigo-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.data && msg.data.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                        {msg.data.map((item, j) => (
                          <div key={j} className="flex justify-between text-sm">
                            <span className="text-gray-600">{item.label}</span>
                            <span className="font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 p-4 rounded-2xl">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your expenses..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-xl shadow-sm flex items-center gap-3">
          <Receipt className="h-5 w-5 text-indigo-600" />
          <div>
            <p className="text-xs text-gray-500">Total Expenses</p>
            <p className="font-semibold text-gray-900">{expenses.length}</p>
          </div>
        </div>
        <div className="p-3 bg-white rounded-xl shadow-sm flex items-center gap-3">
          <FileText className="h-5 w-5 text-purple-600" />
          <div>
            <p className="text-xs text-gray-500">Reports</p>
            <p className="font-semibold text-gray-900">{reports.length}</p>
          </div>
        </div>
        <div className="p-3 bg-white rounded-xl shadow-sm flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-xs text-gray-500">This Month</p>
            <p className="font-semibold text-gray-900">
              {formatCurrency(
                expenses
                  .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
                  .reduce((sum, e) => sum + (e.amount || 0), 0),
                baseCurrency
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}