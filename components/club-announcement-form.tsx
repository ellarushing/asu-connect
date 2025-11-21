'use client';

import { useState } from 'react';
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

// ============================================================================
// TYPES
// ============================================================================

interface ClubAnnouncementFormProps {
  clubId: string;
  announcementId?: string;
  initialTitle?: string;
  initialContent?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ClubAnnouncementForm({
  clubId,
  announcementId,
  initialTitle = '',
  initialContent = '',
  onSuccess,
  onCancel,
}: ClubAnnouncementFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: initialTitle,
    content: initialContent,
  });

  const isEditMode = !!announcementId;

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
    setSuccess(null);
    setLoading(true);

    try {
      // Validate form
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }

      if (formData.title.length > 200) {
        throw new Error('Title must be 200 characters or less');
      }

      if (!formData.content.trim()) {
        throw new Error('Content is required');
      }

      if (formData.content.length > 5000) {
        throw new Error('Content must be 5000 characters or less');
      }

      // Submit to API
      const url = isEditMode
        ? `/api/clubs/${clubId}/announcements/${announcementId}`
        : `/api/clubs/${clubId}/announcements`;

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          content: formData.content.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save announcement');
      }

      const data = await response.json();

      // Show success message
      setSuccess(data.message || 'Announcement saved successfully');

      // Reset form if creating new announcement
      if (!isEditMode) {
        setFormData({
          title: '',
          content: '',
        });
      }

      // Call success callback after a short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? 'Edit Announcement' : 'New Announcement'}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update your announcement'
            : 'Share important updates with club members'}
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
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              type="text"
              placeholder="Enter announcement title"
              value={formData.title}
              onChange={handleInputChange}
              maxLength={200}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {formData.title.length}/200 characters
            </p>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              name="content"
              placeholder="Enter announcement content"
              value={formData.content}
              onChange={handleInputChange}
              maxLength={5000}
              rows={8}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {formData.content.length}/5000 characters
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-6">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={loading}
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading
                ? isEditMode
                  ? 'Updating...'
                  : 'Creating...'
                : isEditMode
                  ? 'Update Announcement'
                  : 'Create Announcement'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
