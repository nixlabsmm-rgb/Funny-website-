export interface NotificationSettings {
  newPost: boolean;
  newReaction: boolean;
  newComment: boolean;
  newMessage: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  photoURL: string;
  bio: string;
  onboarded: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt?: any;
  notificationSettings: NotificationSettings;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  photoURL?: string;
  createdAt: any; // Firestore Timestamp
  likesCount: number;
  hahaCount: number;
  careCount: number;
  angryCount: number;
  commentsCount: number;
  hashtags: string[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: any; // Firestore Timestamp
}

export interface Reaction {
  type: 'like' | 'haha' | 'care' | 'angry';
  userId: string;
  createdAt: any;
}

export type ReactionType = 'like' | 'haha' | 'care' | 'angry';

export type AppTab = 'feed' | 'messenger' | 'notifications' | 'profile';
