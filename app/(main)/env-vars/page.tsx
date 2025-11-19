'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EnvVarsPage() {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchEnvVars();
  }, []);

  const fetchEnvVars = async () => {
    try {
      const response = await fetch('/api/env-vars');
      const data = await response.json();
      if (data.success) {
        setEnvVars(data.envVars);
      }
    } catch (error) {
      console.error('[v0] Error fetching env vars:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch environment variables',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      toast({
        title: 'Copied!',
        description: `${key} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const maskValue = (value: string, key: string) => {
    if (!value) return '';
    if (visibleKeys.has(key)) return value;
    return '•'.repeat(Math.min(value.length, 40));
  };

  const exportAll = () => {
    const envText = Object.entries(envVars)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    navigator.clipboard.writeText(envText);
    toast({
      title: 'Exported!',
      description: 'All environment variables copied to clipboard',
    });
  };

  const categories = {
    'Snowflake': ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_ROLE', 'SNOWFLAKE_TABLE'],
    'Database': ['NEON_DATABASE_URL', 'NEON_POSTGRES_URL', 'NEON_PROJECT_ID'],
    'AI APIs': ['GROQ_API_KEY', 'API_KEY_GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY'],
    'Search APIs': ['TAVILY_API_KEY', 'BRAVE_API_KEY', 'NEWS_API_KEY'],
    'Lead APIs': ['HUNTER_API_KEY', 'APOLLO_API_KEY'],
    'Authentication': ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET'],
    'Email': ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'OUTLOOK_CLIENT_ID', 'OUTLOOK_CLIENT_SECRET', 'OUTLOOK_TENANT_ID'],
    'Zoho': ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_DATACENTER'],
    'Upstash': ['UPSTASH_KV_KV_URL', 'UPSTASH_KV_KV_REST_API_TOKEN', 'UPSTASH_KV_KV_REST_API_URL', 'UPSTASH_KV_REDIS_URL'],
    'QStash': ['QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY', 'QSTASH_URL'],
    'Other': ['NEXT_PUBLIC_APP_URL', 'CRON_SECRET'],
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading environment variables...</p>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Environment Variables</h1>
          <p className="text-muted-foreground">View and copy your environment variables for use on other platforms</p>
        </div>
        <Button onClick={exportAll}>Export All</Button>
      </div>

      <div className="grid gap-6">
        {Object.entries(categories).map(([category, keys]) => {
          const hasValues = keys.some((key) => envVars[key]);
          if (!hasValues) return null;

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>
                  {keys.filter((key) => envVars[key]).length} of {keys.length} variables configured
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {keys.map((key) => {
                  const value = envVars[key];
                  if (!value) return null;

                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{key}</Label>
                      <div className="flex gap-2">
                        <Input
                          id={key}
                          value={maskValue(value, key)}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => toggleVisibility(key)}
                        >
                          {visibleKeys.has(key) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(key, value)}
                        >
                          {copiedKey === key ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
