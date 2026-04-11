import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, 
  Switch, Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { 
  X, Save, Layout, Search, HelpCircle, Plus, Trash2, ChevronUp, ChevronDown, 
  Settings, Heading1, Type, Image as ImageIcon, Square, Quote, Minus, Upload, Globe, ArrowLeft, MoreVertical
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';

export type ContentBlock = {
  id: string;
  type: 'heading' | 'text' | 'image' | 'button' | 'quote' | 'divider';
  content?: string;
  level?: number;
  url?: string;
  caption?: string;
  text?: string;
  fontSize?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  variant?: string;
  height?: string;
  color?: string;
};

export type ArticleForm = {
  id?: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  excerpt: string;
  content: string;
  featured_image: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  faqs: Array<{ question: string; answer: string }>;
  content_blocks: ContentBlock[];
  published: boolean;
};

const DEFAULT_FORM: ArticleForm = {
  title: '',
  slug: '',
  category: 'SEO Tips',
  author: 'Primansh Team',
  excerpt: '',
  content: '',
  featured_image: '',
  meta_title: '',
  meta_description: '',
  keywords: [],
  faqs: [],
  content_blocks: [],
  published: false
};

interface Props {
  visible: boolean;
  article?: ArticleForm | null;
  onClose: () => void;
  onSave: () => void;
}

export function ArticleEditorModal({ visible, article, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'faqs'>('content');
  const [formData, setFormData] = useState<ArticleForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    if (article) {
      setFormData(article);
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [article, visible]);

  const handleSave = async () => {
    if (!formData.title || !formData.slug) {
      Alert.alert('Missing Info', 'Title and Slug are required.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('blogs')
        .upsert({
          ...formData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      onSave();
      onClose();
    } catch (error: any) {
      Alert.alert('Save Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const addBlock = (type: ContentBlock['type'], index: number = formData.content_blocks.length) => {
    const newBlock: ContentBlock = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      content: '',
      fontSize: type === 'heading' ? '24px' : '16px',
      textAlign: 'left',
      fontWeight: type === 'heading' ? '700' : '400',
    };

    if (type === 'heading') newBlock.level = 2;
    if (type === 'image') { newBlock.url = ''; newBlock.caption = ''; }
    if (type === 'button') { newBlock.text = 'Click Me'; newBlock.url = '#'; }
    if (type === 'quote') { newBlock.content = 'Inspirational quote...'; }

    const newBlocks = [...formData.content_blocks];
    newBlocks.splice(index, 0, newBlock);
    setFormData({ ...formData, content_blocks: newBlocks });
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setFormData({
      ...formData,
      content_blocks: formData.content_blocks.map(b => b.id === id ? { ...b, ...updates } : b)
    });
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...formData.content_blocks];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newBlocks.length) return;
    [newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
    setFormData({ ...formData, content_blocks: newBlocks });
  };

  const removeBlock = (id: string) => {
    setFormData({
      ...formData,
      content_blocks: formData.content_blocks.filter(b => b.id !== id)
    });
  };

  const handleImagePick = async (target: 'featured' | string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0].uri, target);
    }
  };

  const uploadImage = async (uri: string, target: 'featured' | string) => {
    setUploading(true);
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const ext = uri.split('.').pop();
      const filename = `${Math.random().toString(36).substring(2)}.${ext}`;
      const path = `blog-assets/${filename}`;

      const { error } = await supabase.storage
        .from('blog-images')
        .upload(path, blob);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(path);

      if (target === 'featured') {
        setFormData({ ...formData, featured_image: publicUrl });
      } else {
        updateBlock(target, { url: publicUrl });
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData({ ...formData, keywords: [...formData.keywords, newKeyword.trim()] });
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setFormData({ ...formData, keywords: formData.keywords.filter(k => k !== kw) });
  };

  const addFAQ = () => {
    setFormData({ ...formData, faqs: [...formData.faqs, { question: '', answer: '' }] });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <BlurView intensity={30} tint="dark" style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>{article ? 'Refine Insight' : 'Draft New Insight'}</Text>
                <Text style={styles.headerSubtitle}>// Advanced Blog CMS & SEO Engine</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={loading}>
                  {loading ? <ActivityIndicator size={16} color="#000" /> : <Save color="#000" size={18} />}
                  <Text style={styles.saveButtonText}>Launch</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X color="#fff" size={20} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.tabContainer}>
              {[
                { id: 'content', label: 'DESIGN', icon: Layout },
                { id: 'seo', label: 'SEO', icon: Search },
                { id: 'faqs', label: 'FAQS', icon: HelpCircle },
              ].map(tab => (
                <TouchableOpacity 
                  key={tab.id} 
                  onPress={() => setActiveTab(tab.id as any)}
                  style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                >
                  <tab.icon size={14} color={activeTab === tab.id ? '#85adff' : '#64748b'} />
                  <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 100 }}>
              {activeTab === 'content' && (
                <View style={styles.section}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Article Title</Text>
                    <TextInput 
                      style={styles.inputLarge}
                      value={formData.title}
                      onChangeText={t => setFormData({ ...formData, title: t })}
                      placeholder="e.g. How to scale your CA practice..."
                      placeholderTextColor="rgba(255,255,255,0.2)"
                    />
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Slug</Text>
                      <TextInput 
                        style={styles.input}
                        value={formData.slug}
                        onChangeText={t => setFormData({ ...formData, slug: t.toLowerCase().replace(/\s+/g, '-') })}
                        placeholder="url-friendly-slug"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                      <Text style={styles.label}>Category</Text>
                      <TextInput 
                        style={styles.input}
                        value={formData.category}
                        onChangeText={t => setFormData({ ...formData, category: t })}
                        placeholder="SEO Tips"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Featured Image</Text>
                    <TouchableOpacity style={styles.imageUpload} onPress={() => handleImagePick('featured')}>
                      {formData.featured_image ? (
                        <Image source={{ uri: formData.featured_image }} style={styles.imagePreview} />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          {uploading ? <ActivityIndicator color="#85adff" /> : <Upload color="#64748b" size={24} />}
                          <Text style={styles.imagePlaceholderText}>Upload Featured Image</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Excerpt</Text>
                    <TextInput 
                      style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                      value={formData.excerpt}
                      onChangeText={t => setFormData({ ...formData, excerpt: t })}
                      multiline
                      placeholder="Brief summary for list views..."
                      placeholderTextColor="rgba(255,255,255,0.2)"
                    />
                  </View>

                  <View style={styles.blockToolbar}>
                    <Text style={styles.blockToolbarTitle}>MODULAR BLOCKS</Text>
                    <View style={styles.blockActions}>
                      <TouchableOpacity onPress={() => addBlock('heading')} style={styles.blockActionButton}><Heading1 size={16} color="#85adff" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => addBlock('text')} style={styles.blockActionButton}><Type size={16} color="#85adff" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => addBlock('image')} style={styles.blockActionButton}><ImageIcon size={16} color="#85adff" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => addBlock('quote')} style={styles.blockActionButton}><Quote size={16} color="#85adff" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => addBlock('divider')} style={styles.blockActionButton}><Minus size={16} color="#85adff" /></TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.blockContainer}>
                    {formData.content_blocks.map((block, index) => (
                      <View key={block.id} style={styles.blockItem}>
                        <View style={styles.blockHeader}>
                          <Text style={styles.blockTypeText}>{block.type.toUpperCase()}</Text>
                          <View style={styles.blockHeaderActions}>
                            <TouchableOpacity onPress={() => moveBlock(index, 'up')} style={styles.iconBtn}><ChevronUp size={14} color="#64748b" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => moveBlock(index, 'down')} style={styles.iconBtn}><ChevronDown size={14} color="#64748b" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => removeBlock(block.id)} style={styles.iconBtn}><Trash2 size={14} color="#ff716c" /></TouchableOpacity>
                          </View>
                        </View>

                        {block.type === 'heading' && (
                          <TextInput 
                            style={[styles.blockInput, { fontSize: 24, fontWeight: 'bold' }]}
                            value={block.content}
                            onChangeText={t => updateBlock(block.id, { content: t })}
                            placeholder="Headline..."
                            placeholderTextColor="rgba(255,255,255,0.1)"
                            multiline
                          />
                        )}

                        {block.type === 'text' && (
                          <TextInput 
                            style={[styles.blockInput, { minHeight: 120 }]}
                            value={block.content}
                            onChangeText={t => updateBlock(block.id, { content: t })}
                            placeholder="Start writing..."
                            placeholderTextColor="rgba(255,255,255,0.1)"
                            multiline
                          />
                        )}

                        {block.type === 'image' && (
                          <View>
                            <TouchableOpacity style={styles.inlineImageSelect} onPress={() => handleImagePick(block.id)}>
                              {block.url ? (
                                <Image source={{ uri: block.url }} style={styles.inlineImagePreview} />
                              ) : (
                                <Text style={styles.inlineImagePlaceholder}>Tap to upload image</Text>
                              )}
                            </TouchableOpacity>
                            <TextInput 
                              style={styles.captionInput}
                              value={block.caption}
                              onChangeText={t => updateBlock(block.id, { caption: t })}
                              placeholder="Add caption..."
                              placeholderTextColor="#475569"
                            />
                          </View>
                        )}

                        {block.type === 'quote' && (
                          <View style={styles.quoteBlock}>
                            <Quote size={20} color="#85adff" style={{ marginBottom: 8 }} />
                            <TextInput 
                              style={styles.quoteInput}
                              value={block.content}
                              onChangeText={t => updateBlock(block.id, { content: t })}
                              multiline
                            />
                          </View>
                        )}

                        {block.type === 'divider' && <View style={styles.divider} />}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {activeTab === 'seo' && (
                <View style={styles.section}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Meta Title</Text>
                    <TextInput 
                      style={styles.input}
                      value={formData.meta_title}
                      onChangeText={t => setFormData({ ...formData, meta_title: t })}
                      placeholder="SEO optimized title..."
                      placeholderTextColor="rgba(255,255,255,0.2)"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Meta Description</Text>
                    <TextInput 
                      style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                      value={formData.meta_description}
                      onChangeText={t => setFormData({ ...formData, meta_description: t })}
                      multiline
                      placeholder="Search engine snippet..."
                      placeholderTextColor="rgba(255,255,255,0.2)"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Keywords</Text>
                    <View style={styles.keywordRow}>
                      <TextInput 
                        style={[styles.input, { flex: 1 }]}
                        value={newKeyword}
                        onChangeText={setNewKeyword}
                        onSubmitEditing={addKeyword}
                        placeholder="Add tag..."
                        placeholderTextColor="rgba(255,255,255,0.2)"
                      />
                      <TouchableOpacity onPress={addKeyword} style={styles.addTagBtn}>
                        <Plus size={18} color="#000" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.tagContainer}>
                      {formData.keywords.map(kw => (
                        <View key={kw} style={styles.tag}>
                          <Text style={styles.tagText}>{kw}</Text>
                          <TouchableOpacity onPress={() => removeKeyword(kw)}>
                            <X size={12} color="#85adff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                  
                  <View style={styles.googlePreview}>
                    <Text style={styles.previewLabel}>GOOGLE SEARCH PREVIEW</Text>
                    <Text style={styles.previewUrl}>primansh.com › blog › {formData.slug || '...'}</Text>
                    <Text style={styles.previewTitle} numberOfLines={1}>{formData.meta_title || formData.title || 'Page Title'}</Text>
                    <Text style={styles.previewDesc} numberOfLines={2}>
                      {formData.meta_description || formData.excerpt || 'Provide a compelling description for search engine visibility.'}
                    </Text>
                  </View>
                </View>
              )}

              {activeTab === 'faqs' && (
                <View style={styles.section}>
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqTitle}>SCHEMA FAQ BUILDER</Text>
                    <TouchableOpacity onPress={addFAQ} style={styles.faqAddBtn}>
                      <Plus size={16} color="#85adff" />
                      <Text style={styles.faqAddText}>Add FAQ</Text>
                    </TouchableOpacity>
                  </View>

                  {formData.faqs.map((faq, idx) => (
                    <View key={idx} style={styles.faqItem}>
                      <TextInput 
                        style={styles.faqQuestion}
                        value={faq.question}
                        onChangeText={t => {
                          const f = [...formData.faqs];
                          f[idx].question = t;
                          setFormData({ ...formData, faqs: f });
                        }}
                        placeholder="Question..."
                        placeholderTextColor="#475569"
                      />
                      <TextInput 
                        style={styles.faqAnswer}
                        value={faq.answer}
                        onChangeText={t => {
                          const f = [...formData.faqs];
                          f[idx].answer = t;
                          setFormData({ ...formData, faqs: f });
                        }}
                        multiline
                        placeholder="Answer..."
                        placeholderTextColor="#475569"
                      />
                      <TouchableOpacity 
                        style={styles.faqRemove}
                        onPress={() => setFormData({ ...formData, faqs: formData.faqs.filter((_, i) => i !== idx) })}
                      >
                        <Trash2 size={14} color="#ff716c" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.85)',
  },
  container: {
    flex: 1,
    backgroundColor: '#070b14',
    marginTop: 60,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#fff',
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: '#85adff',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#85adff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  saveButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#000',
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 38,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: 'rgba(133,173,255,0.1)',
  },
  tabText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#64748b',
  },
  activeTabText: {
    color: '#85adff',
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#a6aabc',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    color: '#fff',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
  },
  inputLarge: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    height: 60,
    paddingHorizontal: 20,
    color: '#fff',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
  },
  imageUpload: {
    height: 160,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  imagePlaceholderText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 13,
    color: '#64748b',
  },
  blockToolbar: {
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockToolbarTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 2,
  },
  blockActions: {
    flexDirection: 'row',
    gap: 8,
  },
  blockActionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockContainer: {
    gap: 20,
  },
  blockItem: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 8,
  },
  blockTypeText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: '#64748b',
    letterSpacing: 1,
  },
  blockHeaderActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockInput: {
    color: '#fff',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 16,
    lineHeight: 24,
  },
  inlineImageSelect: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  inlineImagePreview: {
    width: '100%',
    height: '100%',
  },
  inlineImagePlaceholder: {
    color: '#64748b',
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
  },
  captionInput: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 11,
    fontFamily: Fonts.Outfit_400Regular,
    textAlign: 'center',
  },
  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: '#85adff',
    paddingLeft: 16,
    backgroundColor: 'rgba(133,173,255,0.05)',
    borderRadius: 8,
    paddingVertical: 12,
  },
  quoteInput: {
    color: '#d1d5db',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 16,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  keywordRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addTagBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#85adff',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(133,173,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: {
    color: '#85adff',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  googlePreview: {
    marginTop: 32,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  previewLabel: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: '#64748b',
    marginBottom: 16,
    letterSpacing: 1,
  },
  previewUrl: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 18,
    color: '#8ab4f8',
    fontFamily: Fonts.Outfit_500Medium,
    marginBottom: 4,
  },
  previewDesc: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  faqTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 2,
  },
  faqAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(133,173,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  faqAddText: {
    color: '#85adff',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
  },
  faqItem: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  faqQuestion: {
    color: '#fff',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 8,
  },
  faqAnswer: {
    color: '#94a3b8',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 13,
    lineHeight: 20,
  },
  faqRemove: {
    position: 'absolute',
    top: 12,
    right: 12,
  }
});
