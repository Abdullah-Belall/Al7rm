
export enum UserRole {
  CUSTOMER = 'customer',
  SUPPORTER = 'supporter',
  ADMIN = 'admin',
}

export enum UserLanguage {
  ARABIC = 'ar',
  ENGLISH = 'en',
  FRENCH = 'fr',
  GERMAN = 'de',
  RUSSIAN = 'ru',
  CHINESE = 'zh',
  URDU = 'ur',
}

export enum RequestStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RequestPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum RequestCategory {
  PRAYER = 'prayer',
  GUIDANCE = 'guidance',
  EMERGENCY = 'emergency',
  INFORMATION = 'information',
  OTHER = 'other',
}