// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi, contactTypesApi } from '@/lib/api/contacts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, X, Plus, Building2 } from 'lucide-react';
import type { Contact, ContactType } from '@/types';
import { toast } from 'sonner';

interface VendorComboboxProps {
  value: string | null;
  onChange: (vendorId: string | null) => void;
  scopeType?: string | null;
  scopeId?: string | null;
  disabled?: boolean;
  className?: string;
}

export function VendorCombobox({
  value,
  onChange,
  scopeType,
  scopeId,
  disabled = false,
  className = '',
}: VendorComboboxProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load provider contacts
  const { data: providers = [] } = useQuery<Contact[]>({
    queryKey: ['contacts', 'providers', scopeType, scopeId],
    queryFn: () =>
      contactsApi.getAll({
        category: 'PROVIDER',
        isActive: true,
        ...(scopeType && scopeId ? { forScopeType: scopeType, forScopeId: scopeId } : {}),
      }),
  });

  // Resolve selected contact
  const selectedContact = providers.find((c) => c.id === value);

  // Filter by search
  const filtered = providers.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.company?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    );
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (contact: Contact) => {
    onChange(contact.id);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {/* Selected display or search input */}
      {value && selectedContact ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{selectedContact.name}</span>
            {selectedContact.company && (
              <span className="text-xs text-muted-foreground ml-2">{selectedContact.company}</span>
            )}
          </div>
          {!disabled && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Rechercher un fournisseur..."
            className="pl-9"
            disabled={disabled}
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !value && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
                onClick={() => handleSelect(contact)}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{contact.name}</span>
                  {contact.company && (
                    <span className="text-muted-foreground ml-1">— {contact.company}</span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Aucun fournisseur trouve
            </div>
          )}
          <div className="border-t">
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2 text-primary"
              onClick={() => {
                setIsOpen(false);
                setShowCreateDialog(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Creer un fournisseur
            </button>
          </div>
        </div>
      )}

      {/* Create vendor dialog */}
      <CreateVendorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={(contact) => {
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          onChange(contact.id);
          setShowCreateDialog(false);
        }}
        defaultName={searchTerm}
      />
    </div>
  );
}

// ── Inline create dialog ────────────────────────────────────────────────────

function CreateVendorDialog({
  open,
  onOpenChange,
  onCreated,
  defaultName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: Contact) => void;
  defaultName?: string;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Load provider contact types to find the default one
  const { data: contactTypes = [] } = useQuery<ContactType[]>({
    queryKey: ['contact-types', 'provider'],
    queryFn: () => contactTypesApi.getAll({ category: 'PROVIDER', isActive: true }),
    enabled: open,
  });

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setName(defaultName || '');
      setCompany('');
      setEmail('');
      setPhone('');
    }
  }, [open, defaultName]);

  const createMutation = useMutation({
    mutationFn: () => {
      const typeId = contactTypes[0]?.id;
      if (!typeId) throw new Error('Aucun type fournisseur configure');
      return contactsApi.create({
        name,
        typeId,
        company: company || undefined,
        email: email || undefined,
        phone: phone || undefined,
      });
    },
    onSuccess: (contact) => {
      toast.success(`Fournisseur "${contact.name}" cree`);
      onCreated(contact);
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau fournisseur</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nom <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du contact" />
          </div>
          <div className="space-y-1">
            <Label>Entreprise</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@..." />
            </div>
            <div className="space-y-1">
              <Label>Telephone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending || !contactTypes.length}
          >
            {createMutation.isPending ? 'Creation...' : 'Creer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
