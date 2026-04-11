import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { GlassCard } from '../ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { type ClientFormInput, type ClientPlan, type ClientStatus, type MobileClient, type TeamMemberSummary } from '../../lib/clients';

type ClientEditorModalProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  form: ClientFormInput;
  teamMembers: TeamMemberSummary[];
  currentClient?: MobileClient | null;
  saving?: boolean;
  canEditCore: boolean;
  canEditNotes: boolean;
  canEditStatus: boolean;
  onClose: () => void;
  onChange: React.Dispatch<React.SetStateAction<ClientFormInput>>;
  onSubmit: () => void | Promise<void>;
};

const PLAN_OPTIONS: ClientPlan[] = ['basic', 'growth', 'premium'];
const STATUS_OPTIONS: ClientStatus[] = ['active', 'inactive', 'trial'];

export function ClientEditorModal({
  visible,
  mode,
  form,
  teamMembers,
  currentClient,
  saving = false,
  canEditCore,
  canEditNotes,
  canEditStatus,
  onClose,
  onChange,
  onSubmit,
}: ClientEditorModalProps) {
  const [servicesInput, setServicesInput] = useState('');

  useEffect(() => {
    setServicesInput((form.services || []).join(', '));
  }, [form.services, visible]);

  const title = mode === 'create' ? 'Add Client' : currentClient?.firm_name || 'Edit Client';
  const subtitle = mode === 'create' ? 'Create a new client record.' : 'Update the selected client record.';

  const toggleTeamMember = (memberId: string) => {
    onChange((current) => {
      const existing = Array.isArray(current.assigned_team_member_ids) ? current.assigned_team_member_ids : [];
      const hasMember = existing.includes(memberId);
      const nextIds = hasMember ? existing.filter((id) => id !== memberId) : [...existing, memberId];
      return {
        ...current,
        assigned_team_member_ids: nextIds,
        assigned_team_member_id: nextIds[0] || null,
      };
    });
  };

  const updateServices = (value: string) => {
    setServicesInput(value);
    onChange((current) => ({
      ...current,
      services: value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <Pressable style={styles.cardWrap} onPress={(event) => event.stopPropagation()}>
            <View style={styles.card}>
              <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.title} numberOfLines={1}>{title}</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                  <X color="#94a3b8" size={18} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
              >
                <FieldRow>
                  <Field
                    label="Firm Name"
                    value={form.firm_name}
                    editable={canEditCore || mode === 'create'}
                    placeholder="Firm or company name"
                    onChangeText={(value) => onChange((current) => ({ ...current, firm_name: value }))}
                  />
                  <Field
                    label="Contact Name"
                    value={form.contact_name}
                    editable={canEditCore || mode === 'create'}
                    placeholder="Primary contact"
                    onChangeText={(value) => onChange((current) => ({ ...current, contact_name: value }))}
                  />
                </FieldRow>

                <FieldRow>
                  <Field
                    label="Email"
                    value={form.contact_email}
                    editable={canEditCore || mode === 'create'}
                    placeholder="contact@example.com"
                    onChangeText={(value) => onChange((current) => ({ ...current, contact_email: value }))}
                    keyboardType="email-address"
                  />
                  <Field
                    label="Phone"
                    value={form.contact_phone}
                    editable={canEditCore || mode === 'create'}
                    placeholder="+1 555 000 0000"
                    onChangeText={(value) => onChange((current) => ({ ...current, contact_phone: value }))}
                    keyboardType="phone-pad"
                  />
                </FieldRow>

                <FieldRow>
                  <Field
                    label="Location"
                    value={form.location}
                    editable={canEditCore || mode === 'create'}
                    placeholder="City or region"
                    onChangeText={(value) => onChange((current) => ({ ...current, location: value }))}
                  />
                  <Field
                    label="Website"
                    value={form.website_url}
                    editable={canEditCore || mode === 'create'}
                    placeholder="https://example.com"
                    onChangeText={(value) => onChange((current) => ({ ...current, website_url: value }))}
                  />
                </FieldRow>

                <Text style={styles.sectionLabel}>Plan</Text>
                <PillRow>
                  {PLAN_OPTIONS.map((plan) => {
                    const active = form.plan_type === plan;
                    return (
                      <TogglePill
                        key={plan}
                        label={plan}
                        active={active}
                        disabled={!canEditCore && mode !== 'create'}
                        onPress={() => onChange((current) => ({ ...current, plan_type: plan }))}
                      />
                    );
                  })}
                </PillRow>

                <Text style={styles.sectionLabel}>Status</Text>
                <PillRow>
                  {STATUS_OPTIONS.map((status) => {
                    const active = form.status === status;
                    return (
                      <TogglePill
                        key={status}
                        label={status}
                        active={active}
                        disabled={!canEditStatus && mode !== 'create'}
                        onPress={() => onChange((current) => ({ ...current, status }))}
                      />
                    );
                  })}
                </PillRow>

                <FieldRow>
                  <Field
                    label="Onboarding Date"
                    value={form.onboarding_date}
                    editable={canEditCore || mode === 'create'}
                    placeholder="YYYY-MM-DD"
                    onChangeText={(value) => onChange((current) => ({ ...current, onboarding_date: value }))}
                  />
                  <Field
                    label="Health Score"
                    value={String(form.health_score)}
                    editable={canEditCore || mode === 'create'}
                    placeholder="50"
                    onChangeText={(value) =>
                      onChange((current) => ({
                        ...current,
                        health_score: Number(value) || 0,
                      }))
                    }
                    keyboardType="numeric"
                  />
                </FieldRow>

                <Text style={styles.sectionLabel}>Assigned Team</Text>
                <View style={styles.teamGrid}>
                  {teamMembers.map((member) => {
                    const active = (form.assigned_team_member_ids || []).includes(member.id);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        activeOpacity={0.85}
                        disabled={!canEditCore && mode !== 'create'}
                        onPress={() => toggleTeamMember(member.id)}
                        style={[styles.teamChip, active && styles.teamChipActive]}
                      >
                        <Text style={[styles.teamChipText, active && styles.teamChipTextActive]}>
                          {member.full_name || member.email || 'Member'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.sectionLabel}>Notes</Text>
                <TextInput
                  value={form.notes}
                  editable={canEditNotes || mode === 'create'}
                  onChangeText={(value) => onChange((current) => ({ ...current, notes: value }))}
                  placeholder="Optional notes"
                  placeholderTextColor="#64748b"
                  multiline
                  style={[styles.input, styles.textArea, !(canEditNotes || mode === 'create') && styles.inputDisabled]}
                />

                <Text style={styles.sectionLabel}>Services</Text>
                <TextInput
                  value={servicesInput}
                  editable={canEditCore || mode === 'create'}
                  onChangeText={updateServices}
                  placeholder="Comma-separated services"
                  placeholderTextColor="#64748b"
                  style={[styles.input, !(canEditCore || mode === 'create') && styles.inputDisabled]}
                />

                {mode === 'create' ? (
                  <>
                    <Text style={styles.sectionLabel}>Portal Access Password</Text>
                    <TextInput
                      value={form.password}
                      editable={canEditCore || mode === 'create'}
                      onChangeText={(value) => onChange((current) => ({ ...current, password: value }))}
                      placeholder="Optional"
                      placeholderTextColor="#64748b"
                      secureTextEntry
                      style={[styles.input, !(canEditCore || mode === 'create') && styles.inputDisabled]}
                    />
                  </>
                ) : null}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={saving}
                  onPress={onSubmit}
                  style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                >
                  <Text style={styles.submitButtonText}>
                    {saving ? 'Saving...' : mode === 'create' ? 'Create Client' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

function PillRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.pillRow}>{children}</View>;
}

function Field({
  label,
  value,
  editable,
  placeholder,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  editable: boolean;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        keyboardType={keyboardType}
        style={[styles.input, !editable && styles.inputDisabled]}
      />
    </View>
  );
}

function TogglePill({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive, disabled && styles.pillDisabled]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    maxHeight: '88%',
    flexShrink: 1,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate500,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
    gap: 16,
  },
  footer: {
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  field: {
    flex: 1,
    gap: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  label: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.slate500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 12,
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 13,
  },
  textArea: {
    minHeight: 88,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    opacity: 0.55,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pillActive: {
    backgroundColor: '#6e9fff',
    borderColor: 'rgba(110,159,255,0.35)',
  },
  pillDisabled: {
    opacity: 0.45,
  },
  pillText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
    color: '#a6aabc',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pillTextActive: {
    color: '#000000',
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  teamChipActive: {
    backgroundColor: 'rgba(133, 173, 255, 0.16)',
    borderColor: 'rgba(133, 173, 255, 0.25)',
  },
  teamChipText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 12,
    color: '#a6aabc',
  },
  teamChipTextActive: {
    color: '#85adff',
  },
  submitButton: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6e9fff',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
