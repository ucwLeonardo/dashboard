export interface CourseIdentityLike {
  title: string;
  url: string;
}

const LOCALE_SUFFIX_RE = /([ +]V\d+)-[A-Za-z]{2,5}$/;

const normalizeCourseId = (courseId: string) => courseId.replace(LOCALE_SUFFIX_RE, '$1');

const normalizeUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();

  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    url.hash = '';
    const normalized = `${url.origin}${url.pathname}${url.search}`;
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
};

const extractCourseId = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const courseId = url.searchParams.get('course_id');
    return courseId ? normalizeCourseId(courseId) : null;
  } catch {
    const match = rawUrl.match(/[?&]course_id=([^&#]+)/);
    return match ? normalizeCourseId(decodeURIComponent(match[1])) : null;
  }
};

export const getCourseIdentity = (course: CourseIdentityLike) => {
  const courseId = extractCourseId(course.url);

  if (courseId) {
    return `course:${courseId}`;
  }

  return `fallback:${course.title.trim()}|${normalizeUrl(course.url)}`;
};
