import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useContent Hook
 * Fetches dynamic content from the 'site_content' table based on page and section.
 * Provides a reliable fallback to hardcoded defaults if no custom knowledge exists.
 */
export const useContent = (pageSlug: string, sectionName: string, fallback: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['site_content', pageSlug, sectionName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_content')
        .select('content_text')
        .eq('page_slug', pageSlug)
        .eq('section_name', sectionName)
        .maybeSingle();

      if (error) {
        console.error(`Sync error for [${pageSlug}/${sectionName}]:`, error);
        return null;
      }
      return data?.content_text || null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  return {
    content: data || fallback,
    isLoading,
    isCustom: !!data
  };
};
