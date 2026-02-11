export interface Server {
    id: number;
    name: string;
    domain: string;
    ip: string;
    api_port: number;
    api_token: string;
    xray_port: number;
    max_users: number;
    current_users: number;
    status: 'active' | 'maintenance' | 'offline';
    location: string;
    created_at: Date;
    updated_at: Date;
    last_checked_at?: Date;
    is_active: boolean;
}

export interface ServerStatus extends Server {
    available_slots: number;
    availability: 'available' | 'full' | 'active' | 'maintenance' | 'offline';
}