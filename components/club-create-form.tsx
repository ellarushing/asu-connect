'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function ClubCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate form
      if (!formData.name.trim()) {
        throw new Error('Club name is required');
      }

      if (formData.name.length > 255) {
        throw new Error('Club name must be 255 characters or less');
      }

      if (formData.description.length > 1000) {
        throw new Error('Description must be 1000 characters or less');
      }

      // Submit to API
      const response = await fetch('/api/clubs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create club');
      }

      const data = await response.json();

      // Show success message
      setSuccess(data.message);

      // Redirect to club page after a short delay
      setTimeout(() => {
        router.push(`/clubs/${data.club.id}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Club</CardTitle>
        <CardDescription>
          Create a new club to organize your community
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-md flex items-start gap-2">
            <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
            <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Club Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Club Name *</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Enter club name"
              value={formData.name}
              onChange={handleInputChange}
              maxLength={255}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {formData.name.length}/255 characters
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Enter club description (optional)"
              value={formData.description}
              onChange={handleInputChange}
              maxLength={1000}
              rows={5}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/1000 characters
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-6">
            <Link href="/clubs" className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Club'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
