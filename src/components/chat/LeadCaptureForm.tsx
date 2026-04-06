import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2 } from 'lucide-react';

export function LeadCaptureForm({ onComplete }: { onComplete: () => void }) {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        industry: '',
        budget: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('leads').insert([{
                ...formData,
                source: 'website_bot'
            }]);
            if (error) throw error;
            setSubmitted(true);
            setTimeout(onComplete, 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="p-4 bg-emerald-50 rounded-2xl flex flex-col items-center text-center space-y-2 border border-emerald-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-emerald-900 font-medium font-serif">Brilliant! I've received your details. One of our growth strategists will be in touch shortly.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 rounded-2xl space-y-3 border border-gray-100 shadow-sm">
            <h4 className="font-serif font-bold text-gray-800">Secure Your Free Growth Audit</h4>
            <div className="space-y-2">
                <Input 
                    placeholder="Your Name" 
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="bg-white border-gray-200"
                />
                <Input 
                    placeholder="Email Address" 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="bg-white border-gray-200"
                />
                <div className="grid grid-cols-2 gap-2">
                    <Input 
                        placeholder="Industry" 
                        value={formData.industry}
                        onChange={e => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                        className="bg-white border-gray-200"
                    />
                    <Input 
                        placeholder="BudgetContext" 
                        value={formData.budget}
                        onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                        className="bg-white border-gray-200"
                    />
                </div>
            </div>
            <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Audit Now"}
            </Button>
        </form>
    );
}
