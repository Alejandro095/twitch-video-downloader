export interface CommentsPage {
    comments: Comment[];
    _next?: string;
    _prev?: string;
}

export interface Comment {
    _id: string;
    created_at: Date;
    updated_at: Date;
    channel_id: string;
    content_type: any;
    content_id: string;
    content_offset_seconds: number;
    commenter: any;
    source: any;
    state: any;
    message: any;
}
