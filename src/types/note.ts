export interface Note {
  id?: string;
  videoUrl: string;
  title: string;
  duration: string;
  summary: string;
  keyPoints: string[];
  sections: {
    title: string;
    content: string;
    timestamp?: string;
  }[];
  created_at?: string;
  updated_at?: string;
}

export interface NoteFromDB {
  id: string;
  user_id: string;
  video_url: string;
  video_title: string;
  duration: string | null;
  summary: string;
  key_points: string[];
  sections: {
    title: string;
    content: string;
    timestamp?: string;
  }[];
  created_at: string;
  updated_at: string;
}

export function dbNoteToNote(dbNote: NoteFromDB): Note {
  return {
    id: dbNote.id,
    videoUrl: dbNote.video_url,
    title: dbNote.video_title,
    duration: dbNote.duration || "Unknown",
    summary: dbNote.summary,
    keyPoints: dbNote.key_points,
    sections: dbNote.sections,
    created_at: dbNote.created_at,
    updated_at: dbNote.updated_at,
  };
}

export function noteToDBNote(note: Note, userId: string): Omit<NoteFromDB, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    video_url: note.videoUrl,
    video_title: note.title,
    duration: note.duration,
    summary: note.summary,
    key_points: note.keyPoints,
    sections: note.sections,
  };
}
