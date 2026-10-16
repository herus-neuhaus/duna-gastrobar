export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
            "alteracoes_cargos": {
                Row: {
                    "autor_id": string | null;
                    "cargo_anterior": string | null;
                    "cargo_novo": string | null;
                    "criado_em": string;
                    "id": string;
                    "motivo": string;
                    "origem": string;
                    "perfil_id": string;
                };
                Insert: {
                    "autor_id"?: string | null;
                    "cargo_anterior"?: string | null;
                    "cargo_novo"?: string | null;
                    "criado_em"?: string;
                    "id"?: string;
                    "motivo": string;
                    "origem": string;
                    "perfil_id": string;
                };
                Update: {
                    "autor_id"?: string | null;
                    "cargo_anterior"?: string | null;
                    "cargo_novo"?: string | null;
                    "criado_em"?: string;
                    "id"?: string;
                    "motivo"?: string;
                    "origem"?: string;
                    "perfil_id"?: string;
                };
                Relationships: [
                ];
            };
            "alteracoes_funcionamento": {
                Row: {
                    "autor_id": string;
                    "configuracao": NonNullable<Json>;
                    "criado_em": string;
                    "id": string;
                    "versao": number;
                };
                Insert: {
                    "autor_id": string;
                    "configuracao": NonNullable<Json>;
                    "criado_em"?: string;
                    "id"?: string;
                    "versao": number;
                };
                Update: {
                    "autor_id"?: string;
                    "configuracao"?: NonNullable<Json>;
                    "criado_em"?: string;
                    "id"?: string;
                    "versao"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "alteracoes_funcionamento_autor_id_fkey";
                        columns: [
                            "autor_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "blacklist": {
                Row: {
                    "blocked_by": string | null;
                    "cpf": string;
                    "created_at": string | null;
                    "end_date": string;
                    "id": string;
                    "name": string;
                    "reason": string | null;
                    "start_date": string | null;
                };
                Insert: {
                    "blocked_by"?: string | null;
                    "cpf": string;
                    "created_at"?: string | null;
                    "end_date": string;
                    "id"?: string;
                    "name": string;
                    "reason"?: string | null;
                    "start_date"?: string | null;
                };
                Update: {
                    "blocked_by"?: string | null;
                    "cpf"?: string;
                    "created_at"?: string | null;
                    "end_date"?: string;
                    "id"?: string;
                    "name"?: string;
                    "reason"?: string | null;
                    "start_date"?: string | null;
                };
                Relationships: [
                ];
            };
            "blocked_dates": {
                Row: {
                    "created_at": string | null;
                    "date": string;
                    "id": string;
                    "reason": string | null;
                    "updated_at": string | null;
                };
                Insert: {
                    "created_at"?: string | null;
                    "date": string;
                    "id"?: string;
                    "reason"?: string | null;
                    "updated_at"?: string | null;
                };
                Update: {
                    "created_at"?: string | null;
                    "date"?: string;
                    "id"?: string;
                    "reason"?: string | null;
                    "updated_at"?: string | null;
                };
                Relationships: [
                ];
            };
            "configuracoes_estabelecimento": {
                Row: {
                    "atualizado_em": string;
                    "funcionamento_configurado": boolean;
                    "id": boolean;
                    "versao": number;
                };
                Insert: {
                    "atualizado_em"?: string;
                    "funcionamento_configurado"?: boolean;
                    "id"?: boolean;
                    "versao"?: number;
                };
                Update: {
                    "atualizado_em"?: string;
                    "funcionamento_configurado"?: boolean;
                    "id"?: boolean;
                    "versao"?: number;
                };
                Relationships: [
                ];
            };
            "decorations": {
                Row: {
                    "active": boolean;
                    "created_at": string;
                    "id": string;
                    "image_path": string;
                    "image_url": string;
                    "name": string;
                    "updated_at": string;
                };
                Insert: {
                    "active"?: boolean;
                    "created_at"?: string;
                    "id"?: string;
                    "image_path": string;
                    "image_url": string;
                    "name": string;
                    "updated_at"?: string;
                };
                Update: {
                    "active"?: boolean;
                    "created_at"?: string;
                    "id"?: string;
                    "image_path"?: string;
                    "image_url"?: string;
                    "name"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                ];
            };
            "dias_funcionamento": {
                Row: {
                    "ativo": boolean;
                    "atualizado_em": string;
                    "data_excecao": string | null;
                    "dia_semana": number | null;
                    "fechado": boolean;
                    "id": string;
                };
                Insert: {
                    "ativo"?: boolean;
                    "atualizado_em"?: string;
                    "data_excecao"?: string | null;
                    "dia_semana"?: number | null;
                    "fechado"?: boolean;
                    "id"?: string;
                };
                Update: {
                    "ativo"?: boolean;
                    "atualizado_em"?: string;
                    "data_excecao"?: string | null;
                    "dia_semana"?: number | null;
                    "fechado"?: boolean;
                    "id"?: string;
                };
                Relationships: [
                ];
            };
            "employee_roles": {
                Row: {
                    "created_at": string | null;
                    "id": string;
                    "name": string;
                };
                Insert: {
                    "created_at"?: string | null;
                    "id"?: string;
                    "name": string;
                };
                Update: {
                    "created_at"?: string | null;
                    "id"?: string;
                    "name"?: string;
                };
                Relationships: [
                ];
            };
            "periodos_funcionamento": {
                Row: {
                    "abre_as": string;
                    "ativo": boolean;
                    "dia_funcionamento_id": string;
                    "encerra_dia_seguinte": boolean;
                    "fecha_as": string;
                    "id": string;
                };
                Insert: {
                    "abre_as": string;
                    "ativo"?: boolean;
                    "dia_funcionamento_id": string;
                    "encerra_dia_seguinte"?: boolean;
                    "fecha_as": string;
                    "id"?: string;
                };
                Update: {
                    "abre_as"?: string;
                    "ativo"?: boolean;
                    "dia_funcionamento_id"?: string;
                    "encerra_dia_seguinte"?: boolean;
                    "fecha_as"?: string;
                    "id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "periodos_funcionamento_dia_funcionamento_id_fkey";
                        columns: [
                            "dia_funcionamento_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "dias_funcionamento";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "profiles": {
                Row: {
                    "created_at": string;
                    "email": string | null;
                    "force_password_change": boolean | null;
                    "full_name": string | null;
                    "id": string;
                    "job_role_id": string | null;
                    "role": string | null;
                    "updated_at": string;
                    "whatsapp": string | null;
                };
                Insert: {
                    "created_at"?: string;
                    "email"?: string | null;
                    "force_password_change"?: boolean | null;
                    "full_name"?: string | null;
                    "id": string;
                    "job_role_id"?: string | null;
                    "role"?: string | null;
                    "updated_at"?: string;
                    "whatsapp"?: string | null;
                };
                Update: {
                    "created_at"?: string;
                    "email"?: string | null;
                    "force_password_change"?: boolean | null;
                    "full_name"?: string | null;
                    "id"?: string;
                    "job_role_id"?: string | null;
                    "role"?: string | null;
                    "updated_at"?: string;
                    "whatsapp"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "profiles_job_role_id_fkey";
                        columns: [
                            "job_role_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "employee_roles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_capacity_override_nonces": {
                Row: {
                    "actor_id": string;
                    "id": string;
                    "next_commercial_turn": string;
                    "next_num_guests": number;
                    "next_reservation_date": string;
                    "occupied_after": number;
                    "occupied_before": number;
                    "operation": string;
                    "reservation_id": string;
                };
                Insert: {
                    "actor_id": string;
                    "id": string;
                    "next_commercial_turn": string;
                    "next_num_guests": number;
                    "next_reservation_date": string;
                    "occupied_after": number;
                    "occupied_before": number;
                    "operation": string;
                    "reservation_id": string;
                };
                Update: {
                    "actor_id"?: string;
                    "id"?: string;
                    "next_commercial_turn"?: string;
                    "next_num_guests"?: number;
                    "next_reservation_date"?: string;
                    "occupied_after"?: number;
                    "occupied_before"?: number;
                    "operation"?: string;
                    "reservation_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_capacity_override_nonces_actor_id_fkey";
                        columns: [
                            "actor_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_override_nonces_id_fkey";
                        columns: [
                            "id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "reservation_capacity_override_uses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_override_nonces_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservation_turn_classification_issues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_override_nonces_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_capacity_override_uses": {
                Row: {
                    "actor_id": string;
                    "created_at": string;
                    "id": string;
                    "next_commercial_turn": string;
                    "next_num_guests": number;
                    "next_reservation_date": string;
                    "occupied_after": number | null;
                    "occupied_before": number | null;
                    "operation": string;
                    "previous_commercial_turn": string | null;
                    "previous_num_guests": number | null;
                    "previous_reservation_date": string | null;
                    "reason": string;
                    "reservation_id": string;
                };
                Insert: {
                    "actor_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "next_commercial_turn": string;
                    "next_num_guests": number;
                    "next_reservation_date": string;
                    "occupied_after"?: number | null;
                    "occupied_before"?: number | null;
                    "operation": string;
                    "previous_commercial_turn"?: string | null;
                    "previous_num_guests"?: number | null;
                    "previous_reservation_date"?: string | null;
                    "reason": string;
                    "reservation_id": string;
                };
                Update: {
                    "actor_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "next_commercial_turn"?: string;
                    "next_num_guests"?: number;
                    "next_reservation_date"?: string;
                    "occupied_after"?: number | null;
                    "occupied_before"?: number | null;
                    "operation"?: string;
                    "previous_commercial_turn"?: string | null;
                    "previous_num_guests"?: number | null;
                    "previous_reservation_date"?: string | null;
                    "reason"?: string;
                    "reservation_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_capacity_override_uses_actor_id_fkey";
                        columns: [
                            "actor_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_override_uses_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservation_turn_classification_issues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_override_uses_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_capacity_permission_audits": {
                Row: {
                    "action": string;
                    "actor_id": string;
                    "created_at": string;
                    "id": string;
                    "profile_id": string;
                    "reason": string;
                };
                Insert: {
                    "action": string;
                    "actor_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "profile_id": string;
                    "reason": string;
                };
                Update: {
                    "action"?: string;
                    "actor_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "profile_id"?: string;
                    "reason"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_capacity_permission_audits_actor_id_fkey";
                        columns: [
                            "actor_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_permission_audits_profile_id_fkey";
                        columns: [
                            "profile_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_capacity_permissions": {
                Row: {
                    "granted_at": string;
                    "granted_by": string;
                    "profile_id": string;
                    "revoked_at": string | null;
                    "revoked_by": string | null;
                };
                Insert: {
                    "granted_at"?: string;
                    "granted_by": string;
                    "profile_id": string;
                    "revoked_at"?: string | null;
                    "revoked_by"?: string | null;
                };
                Update: {
                    "granted_at"?: string;
                    "granted_by"?: string;
                    "profile_id"?: string;
                    "revoked_at"?: string | null;
                    "revoked_by"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_capacity_permissions_granted_by_fkey";
                        columns: [
                            "granted_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_permissions_profile_id_fkey";
                        columns: [
                            "profile_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_capacity_permissions_revoked_by_fkey";
                        columns: [
                            "revoked_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_events": {
                Row: {
                    "actor_type": string;
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "reservation_id": string;
                };
                Insert: {
                    "actor_type"?: string;
                    "created_at"?: string;
                    "event_type": string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "reservation_id": string;
                };
                Update: {
                    "actor_type"?: string;
                    "created_at"?: string;
                    "event_type"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "reservation_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_events_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservation_turn_classification_issues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_events_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_override_audits": {
                Row: {
                    "authorized_by": string;
                    "created_at": string;
                    "effect": NonNullable<Json>;
                    "id": string;
                    "override_type": string;
                    "reason": string;
                    "reservation_date": string;
                    "reservation_id": string;
                    "service_starts_at": string;
                };
                Insert: {
                    "authorized_by": string;
                    "created_at"?: string;
                    "effect"?: NonNullable<Json>;
                    "id"?: string;
                    "override_type": string;
                    "reason": string;
                    "reservation_date": string;
                    "reservation_id": string;
                    "service_starts_at": string;
                };
                Update: {
                    "authorized_by"?: string;
                    "created_at"?: string;
                    "effect"?: NonNullable<Json>;
                    "id"?: string;
                    "override_type"?: string;
                    "reason"?: string;
                    "reservation_date"?: string;
                    "reservation_id"?: string;
                    "service_starts_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_override_audits_authorized_by_fkey";
                        columns: [
                            "authorized_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_override_audits_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservation_turn_classification_issues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_override_audits_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_payments": {
                Row: {
                    "amount": number;
                    "created_at": string;
                    "currency": string;
                    "expires_at": string | null;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "method": string;
                    "paid_at": string | null;
                    "provider": string;
                    "provider_order_id": string;
                    "reservation_id": string;
                    "status": string;
                    "updated_at": string;
                };
                Insert: {
                    "amount": number;
                    "created_at"?: string;
                    "currency"?: string;
                    "expires_at"?: string | null;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "method"?: string;
                    "paid_at"?: string | null;
                    "provider": string;
                    "provider_order_id": string;
                    "reservation_id": string;
                    "status": string;
                    "updated_at"?: string;
                };
                Update: {
                    "amount"?: number;
                    "created_at"?: string;
                    "currency"?: string;
                    "expires_at"?: string | null;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "method"?: string;
                    "paid_at"?: string | null;
                    "provider"?: string;
                    "provider_order_id"?: string;
                    "reservation_id"?: string;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_payments_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservation_turn_classification_issues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_payments_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_recovery_challenges": {
                Row: {
                    "attempts": number;
                    "code_hash": string;
                    "created_at": string;
                    "email_hash": string;
                    "expires_at": string;
                    "id": string;
                    "reservation_ids": (string)[];
                    "verified_at": string | null;
                };
                Insert: {
                    "attempts"?: number;
                    "code_hash": string;
                    "created_at"?: string;
                    "email_hash": string;
                    "expires_at": string;
                    "id"?: string;
                    "reservation_ids"?: (string)[];
                    "verified_at"?: string | null;
                };
                Update: {
                    "attempts"?: number;
                    "code_hash"?: string;
                    "created_at"?: string;
                    "email_hash"?: string;
                    "expires_at"?: string;
                    "id"?: string;
                    "reservation_ids"?: (string)[];
                    "verified_at"?: string | null;
                };
                Relationships: [
                ];
            };
            "reservation_schedule_date_slots": {
                Row: {
                    "active": boolean;
                    "commercial_turn": string | null;
                    "created_at": string;
                    "ends_at": string;
                    "id": string;
                    "periodo_funcionamento_id": string | null;
                    "reservation_date": string;
                    "reservation_duration_minutes": number;
                    "slot_interval_minutes": number;
                    "starts_at": string;
                    "turnover_buffer_minutes": number;
                    "updated_at": string;
                };
                Insert: {
                    "active"?: boolean;
                    "commercial_turn"?: string | null;
                    "created_at"?: string;
                    "ends_at": string;
                    "id"?: string;
                    "periodo_funcionamento_id"?: string | null;
                    "reservation_date": string;
                    "reservation_duration_minutes"?: number;
                    "slot_interval_minutes"?: number;
                    "starts_at": string;
                    "turnover_buffer_minutes"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "active"?: boolean;
                    "commercial_turn"?: string | null;
                    "created_at"?: string;
                    "ends_at"?: string;
                    "id"?: string;
                    "periodo_funcionamento_id"?: string | null;
                    "reservation_date"?: string;
                    "reservation_duration_minutes"?: number;
                    "slot_interval_minutes"?: number;
                    "starts_at"?: string;
                    "turnover_buffer_minutes"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_schedule_date_slots_periodo_funcionamento_id_fkey";
                        columns: [
                            "periodo_funcionamento_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "periodos_funcionamento";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_schedule_slots": {
                Row: {
                    "active": boolean;
                    "commercial_turn": string | null;
                    "created_at": string;
                    "day_of_week": number;
                    "ends_at": string;
                    "id": string;
                    "periodo_funcionamento_id": string | null;
                    "reservation_duration_minutes": number;
                    "slot_interval_minutes": number;
                    "starts_at": string;
                    "turnover_buffer_minutes": number;
                    "updated_at": string;
                };
                Insert: {
                    "active"?: boolean;
                    "commercial_turn"?: string | null;
                    "created_at"?: string;
                    "day_of_week": number;
                    "ends_at": string;
                    "id"?: string;
                    "periodo_funcionamento_id"?: string | null;
                    "reservation_duration_minutes"?: number;
                    "slot_interval_minutes"?: number;
                    "starts_at": string;
                    "turnover_buffer_minutes"?: number;
                    "updated_at"?: string;
                };
                Update: {
                    "active"?: boolean;
                    "commercial_turn"?: string | null;
                    "created_at"?: string;
                    "day_of_week"?: number;
                    "ends_at"?: string;
                    "id"?: string;
                    "periodo_funcionamento_id"?: string | null;
                    "reservation_duration_minutes"?: number;
                    "slot_interval_minutes"?: number;
                    "starts_at"?: string;
                    "turnover_buffer_minutes"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_schedule_slots_periodo_funcionamento_id_fkey";
                        columns: [
                            "periodo_funcionamento_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "periodos_funcionamento";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservation_table_assignments": {
                Row: {
                    "allocated_capacity": number;
                    "assigned_at": string;
                    "assigned_by": string | null;
                    "created_at": string;
                    "ends_at": string;
                    "id": string;
                    "occupancy_range": unknown;
                    "released_at": string | null;
                    "reservation_id": string;
                    "starts_at": string;
                    "table_id": string;
                };
                Insert: {
                    "allocated_capacity": number;
                    "assigned_at"?: string;
                    "assigned_by"?: string | null;
                    "created_at"?: string;
                    "ends_at": string;
                    "id"?: string;
                    "occupancy_range"?: never;
                    "released_at"?: string | null;
                    "reservation_id": string;
                    "starts_at": string;
                    "table_id": string;
                };
                Update: {
                    "allocated_capacity"?: number;
                    "assigned_at"?: string;
                    "assigned_by"?: string | null;
                    "created_at"?: string;
                    "ends_at"?: string;
                    "id"?: string;
                    "occupancy_range"?: never;
                    "released_at"?: string | null;
                    "reservation_id"?: string;
                    "starts_at"?: string;
                    "table_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservation_table_assignments_assigned_by_fkey";
                        columns: [
                            "assigned_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_table_assignments_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservation_turn_classification_issues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_table_assignments_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservation_table_assignments_table_id_fkey";
                        columns: [
                            "table_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "restaurant_tables";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservations": {
                Row: {
                    "arrived_at": string | null;
                    "birth_date": string | null;
                    "capacity_override_authorized_at": string | null;
                    "capacity_override_authorized_by": string | null;
                    "capacity_override_effect": NonNullable<Json>;
                    "capacity_override_reason": string | null;
                    "check_in_status": string | null;
                    "commercial_turn": string | null;
                    "completed_at": string | null;
                    "cpf": string | null;
                    "created_at": string;
                    "customer_id": string | null;
                    "decoration_id": string | null;
                    "decoration_service_starts_at": string | null;
                    "duracao_reserva_minutos": number | null;
                    "email": string | null;
                    "expires_at": string | null;
                    "id": string;
                    "intervalo_troca_minutos": number | null;
                    "location_id": string | null;
                    "name": string;
                    "notes": string | null;
                    "num_guests": number;
                    "payment_amount": number | null;
                    "payment_status": string | null;
                    "periodo_funcionamento_id": string | null;
                    "reservation_access_token_hash": string | null;
                    "reservation_date": string;
                    "reservation_time": string;
                    "schedule_override_authorized_at": string | null;
                    "schedule_override_authorized_by": string | null;
                    "schedule_override_reason": string | null;
                    "seated_at": string | null;
                    "service_starts_at": string | null;
                    "source": string;
                    "special_date_id": string | null;
                    "status": string | null;
                    "type": string | null;
                    "updated_at": string;
                    "whatsapp": string;
                };
                Insert: {
                    "arrived_at"?: string | null;
                    "birth_date"?: string | null;
                    "capacity_override_authorized_at"?: string | null;
                    "capacity_override_authorized_by"?: string | null;
                    "capacity_override_effect"?: NonNullable<Json>;
                    "capacity_override_reason"?: string | null;
                    "check_in_status"?: string | null;
                    "commercial_turn"?: string | null;
                    "completed_at"?: string | null;
                    "cpf"?: string | null;
                    "created_at"?: string;
                    "customer_id"?: string | null;
                    "decoration_id"?: string | null;
                    "decoration_service_starts_at"?: string | null;
                    "duracao_reserva_minutos"?: number | null;
                    "email"?: string | null;
                    "expires_at"?: string | null;
                    "id"?: string;
                    "intervalo_troca_minutos"?: number | null;
                    "location_id"?: string | null;
                    "name": string;
                    "notes"?: string | null;
                    "num_guests": number;
                    "payment_amount"?: number | null;
                    "payment_status"?: string | null;
                    "periodo_funcionamento_id"?: string | null;
                    "reservation_access_token_hash"?: string | null;
                    "reservation_date": string;
                    "reservation_time": string;
                    "schedule_override_authorized_at"?: string | null;
                    "schedule_override_authorized_by"?: string | null;
                    "schedule_override_reason"?: string | null;
                    "seated_at"?: string | null;
                    "service_starts_at"?: string | null;
                    "source"?: string;
                    "special_date_id"?: string | null;
                    "status"?: string | null;
                    "type"?: string | null;
                    "updated_at"?: string;
                    "whatsapp": string;
                };
                Update: {
                    "arrived_at"?: string | null;
                    "birth_date"?: string | null;
                    "capacity_override_authorized_at"?: string | null;
                    "capacity_override_authorized_by"?: string | null;
                    "capacity_override_effect"?: NonNullable<Json>;
                    "capacity_override_reason"?: string | null;
                    "check_in_status"?: string | null;
                    "commercial_turn"?: string | null;
                    "completed_at"?: string | null;
                    "cpf"?: string | null;
                    "created_at"?: string;
                    "customer_id"?: string | null;
                    "decoration_id"?: string | null;
                    "decoration_service_starts_at"?: string | null;
                    "duracao_reserva_minutos"?: number | null;
                    "email"?: string | null;
                    "expires_at"?: string | null;
                    "id"?: string;
                    "intervalo_troca_minutos"?: number | null;
                    "location_id"?: string | null;
                    "name"?: string;
                    "notes"?: string | null;
                    "num_guests"?: number;
                    "payment_amount"?: number | null;
                    "payment_status"?: string | null;
                    "periodo_funcionamento_id"?: string | null;
                    "reservation_access_token_hash"?: string | null;
                    "reservation_date"?: string;
                    "reservation_time"?: string;
                    "schedule_override_authorized_at"?: string | null;
                    "schedule_override_authorized_by"?: string | null;
                    "schedule_override_reason"?: string | null;
                    "seated_at"?: string | null;
                    "service_starts_at"?: string | null;
                    "source"?: string;
                    "special_date_id"?: string | null;
                    "status"?: string | null;
                    "type"?: string | null;
                    "updated_at"?: string;
                    "whatsapp"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservations_capacity_override_authorized_by_fkey";
                        columns: [
                            "capacity_override_authorized_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservations_customer_id_fkey";
                        columns: [
                            "customer_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservations_decoration_id_fkey";
                        columns: [
                            "decoration_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "decorations";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservations_periodo_funcionamento_id_fkey";
                        columns: [
                            "periodo_funcionamento_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "periodos_funcionamento";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservations_schedule_override_authorized_by_fkey";
                        columns: [
                            "schedule_override_authorized_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservations_special_date_id_fkey";
                        columns: [
                            "special_date_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "special_dates";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "restaurant_areas": {
                Row: {
                    "active": boolean;
                    "created_at": string;
                    "description": string | null;
                    "display_order": number;
                    "id": string;
                    "name": string;
                    "updated_at": string;
                };
                Insert: {
                    "active"?: boolean;
                    "created_at"?: string;
                    "description"?: string | null;
                    "display_order"?: number;
                    "id"?: string;
                    "name": string;
                    "updated_at"?: string;
                };
                Update: {
                    "active"?: boolean;
                    "created_at"?: string;
                    "description"?: string | null;
                    "display_order"?: number;
                    "id"?: string;
                    "name"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                ];
            };
            "restaurant_tables": {
                Row: {
                    "active": boolean;
                    "area_id": string;
                    "code": string;
                    "created_at": string;
                    "id": string;
                    "max_capacity": number;
                    "min_capacity": number;
                    "updated_at": string;
                };
                Insert: {
                    "active"?: boolean;
                    "area_id": string;
                    "code": string;
                    "created_at"?: string;
                    "id"?: string;
                    "max_capacity": number;
                    "min_capacity": number;
                    "updated_at"?: string;
                };
                Update: {
                    "active"?: boolean;
                    "area_id"?: string;
                    "code"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "max_capacity"?: number;
                    "min_capacity"?: number;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "restaurant_tables_area_id_fkey";
                        columns: [
                            "area_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "restaurant_areas";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "special_dates": {
                Row: {
                    "created_at": string | null;
                    "date": string;
                    "description": string | null;
                    "fee_amount": number | null;
                    "id": string;
                    "included_guests": number | null;
                    "requires_fee": boolean | null;
                    "updated_at": string | null;
                };
                Insert: {
                    "created_at"?: string | null;
                    "date": string;
                    "description"?: string | null;
                    "fee_amount"?: number | null;
                    "id"?: string;
                    "included_guests"?: number | null;
                    "requires_fee"?: boolean | null;
                    "updated_at"?: string | null;
                };
                Update: {
                    "created_at"?: string | null;
                    "date"?: string;
                    "description"?: string | null;
                    "fee_amount"?: number | null;
                    "id"?: string;
                    "included_guests"?: number | null;
                    "requires_fee"?: boolean | null;
                    "updated_at"?: string | null;
                };
                Relationships: [
                ];
            };
            "task_categories": {
                Row: {
                    "created_at": string | null;
                    "id": string;
                    "name": string;
                };
                Insert: {
                    "created_at"?: string | null;
                    "id"?: string;
                    "name": string;
                };
                Update: {
                    "created_at"?: string | null;
                    "id"?: string;
                    "name"?: string;
                };
                Relationships: [
                ];
            };
            "task_completions": {
                Row: {
                    "completed_at": string | null;
                    "employee_id": string | null;
                    "execution_date": string;
                    "id": string;
                    "reviewed_at": string | null;
                    "reviewed_by": string | null;
                    "started_at": string | null;
                    "status": string;
                    "task_id": string | null;
                };
                Insert: {
                    "completed_at"?: string | null;
                    "employee_id"?: string | null;
                    "execution_date": string;
                    "id"?: string;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "started_at"?: string | null;
                    "status": string;
                    "task_id"?: string | null;
                };
                Update: {
                    "completed_at"?: string | null;
                    "employee_id"?: string | null;
                    "execution_date"?: string;
                    "id"?: string;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "started_at"?: string | null;
                    "status"?: string;
                    "task_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "task_completions_employee_id_fkey";
                        columns: [
                            "employee_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "task_completions_reviewed_by_fkey";
                        columns: [
                            "reviewed_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "task_completions_task_id_fkey";
                        columns: [
                            "task_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "tasks";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "tasks": {
                Row: {
                    "assigned_employee_id": string | null;
                    "assigned_role_id": string | null;
                    "category_id": string | null;
                    "created_at": string | null;
                    "description": string | null;
                    "id": string;
                    "is_daily": boolean | null;
                    "scheduled_time": string | null;
                    "target_date": string | null;
                    "time_estimate_minutes": number;
                    "title": string;
                };
                Insert: {
                    "assigned_employee_id"?: string | null;
                    "assigned_role_id"?: string | null;
                    "category_id"?: string | null;
                    "created_at"?: string | null;
                    "description"?: string | null;
                    "id"?: string;
                    "is_daily"?: boolean | null;
                    "scheduled_time"?: string | null;
                    "target_date"?: string | null;
                    "time_estimate_minutes": number;
                    "title": string;
                };
                Update: {
                    "assigned_employee_id"?: string | null;
                    "assigned_role_id"?: string | null;
                    "category_id"?: string | null;
                    "created_at"?: string | null;
                    "description"?: string | null;
                    "id"?: string;
                    "is_daily"?: boolean | null;
                    "scheduled_time"?: string | null;
                    "target_date"?: string | null;
                    "time_estimate_minutes"?: number;
                    "title"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "tasks_assigned_employee_id_fkey";
                        columns: [
                            "assigned_employee_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "tasks_assigned_role_id_fkey";
                        columns: [
                            "assigned_role_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "employee_roles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "tasks_category_id_fkey";
                        columns: [
                            "category_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "task_categories";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "waitlist_entries": {
                Row: {
                    "cancelled_at": string | null;
                    "created_at": string;
                    "id": string;
                    "name": string;
                    "notes": string | null;
                    "party_size": number;
                    "phone": string;
                    "preferred_area_id": string | null;
                    "reservation_id": string | null;
                    "seated_at": string | null;
                    "status": string;
                    "updated_at": string;
                };
                Insert: {
                    "cancelled_at"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "name": string;
                    "notes"?: string | null;
                    "party_size": number;
                    "phone": string;
                    "preferred_area_id"?: string | null;
                    "reservation_id"?: string | null;
                    "seated_at"?: string | null;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "cancelled_at"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "name"?: string;
                    "notes"?: string | null;
                    "party_size"?: number;
                    "phone"?: string;
                    "preferred_area_id"?: string | null;
                    "reservation_id"?: string | null;
                    "seated_at"?: string | null;
                    "status"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "waitlist_entries_preferred_area_id_fkey";
                        columns: [
                            "preferred_area_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "restaurant_areas";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "waitlist_entries_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "reservation_turn_classification_issues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "waitlist_entries_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "whatsapp_templates": {
                Row: {
                    "content": string;
                    "created_at": string | null;
                    "id": string;
                    "title": string;
                    "updated_at": string | null;
                };
                Insert: {
                    "content": string;
                    "created_at"?: string | null;
                    "id"?: string;
                    "title": string;
                    "updated_at"?: string | null;
                };
                Update: {
                    "content"?: string;
                    "created_at"?: string | null;
                    "id"?: string;
                    "title"?: string;
                    "updated_at"?: string | null;
                };
                Relationships: [
                ];
            };
        };
        Views: {
            "reservation_turn_classification_issues": {
                Row: {
                    "commercial_turn": string | null;
                    "created_at": string | null;
                    "id": string | null;
                    "num_guests": number | null;
                    "reservation_date": string | null;
                    "reservation_time": string | null;
                    "source": string | null;
                    "status": string | null;
                };
                Insert: {
                    "commercial_turn"?: string | null;
                    "created_at"?: string | null;
                    "id"?: string | null;
                    "num_guests"?: number | null;
                    "reservation_date"?: string | null;
                    "reservation_time"?: string | null;
                    "source"?: string | null;
                    "status"?: string | null;
                };
                Update: {
                    "commercial_turn"?: string | null;
                    "created_at"?: string | null;
                    "id"?: string | null;
                    "num_guests"?: number | null;
                    "reservation_date"?: string | null;
                    "reservation_time"?: string | null;
                    "source"?: string | null;
                    "status"?: string | null;
                };
                Relationships: [
                ];
            };
        };
        Functions: {
            "can_override_reservation_capacity": {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            "cancel_reservation_with_access_token": {
                Args: {
                    "p_access_token_hash": string;
                    "p_reservation_id": string;
                };
                Returns: {
                    "id": string;
                    "status": string;
                }[];
            };
            "classify_reservation_commercial_turn": {
                Args: {
                    "p_commercial_turn": string;
                    "p_reason": string;
                    "p_reservation_id": string;
                };
                Returns: {
                    "commercial_turn": string;
                    "id": string;
                }[];
            };
            "classify_reservation_service_period": {
                Args: {
                    "p_reason": string;
                    "p_reservation_id": string;
                    "p_service_starts_at": string;
                };
                Returns: {
                    "id": string;
                    "service_starts_at": string;
                }[];
            };
            "complete_reservation_access_recovery": {
                Args: {
                    "p_access_tokens": Json;
                    "p_challenge_id": string;
                    "p_code_hash": string;
                    "p_email_hash": string;
                };
                Returns: {
                    "id": string;
                }[];
            };
            "complete_reservation_payment": {
                Args: {
                    "p_payment_amount": number;
                    "p_reservation_id": string;
                };
                Returns: {
                    "id": string;
                    "payment_status": string;
                    "status": string;
                }[];
            };
            "create_reservation_recovery_challenge": {
                Args: {
                    "p_code_hash": string;
                    "p_email_hash": string;
                    "p_reservation_ids": (string)[];
                };
                Returns: string;
            };
            "create_reservation_with_authorized_overrides": {
                Args: {
                    "p_capacity_override_reason"?: string;
                    "p_commercial_turn"?: string;
                    "p_cpf": string;
                    "p_decoration_id": string;
                    "p_email": string | null;
                    "p_name": string;
                    "p_notes": string;
                    "p_num_guests": number;
                    "p_payment_amount": number;
                    "p_payment_status": string;
                    "p_reservation_access_token_hash": string;
                    "p_reservation_date": string;
                    "p_reservation_time": string;
                    "p_schedule_override_reason"?: string;
                    "p_special_date_id": string;
                    "p_whatsapp": string;
                };
                Returns: {
                    "id": string;
                }[];
            };
            "create_reservation_with_owner_overrides": {
                Args: {
                    "p_capacity_override_reason"?: string;
                    "p_cpf": string;
                    "p_decoration_id": string;
                    "p_email": string | null;
                    "p_name": string;
                    "p_notes": string;
                    "p_num_guests": number;
                    "p_payment_amount": number;
                    "p_payment_status": string;
                    "p_reservation_access_token_hash": string;
                    "p_reservation_date": string;
                    "p_reservation_time": string;
                    "p_schedule_override_reason"?: string;
                    "p_service_starts_at"?: string;
                    "p_special_date_id": string;
                    "p_whatsapp": string;
                };
                Returns: {
                    "id": string;
                }[];
            };
            "create_walk_in_reservation": {
                Args: {
                    "p_cpf"?: string | null;
                    "p_email": string | null;
                    "p_name": string;
                    "p_notes": string;
                    "p_num_guests": number;
                    "p_reservation_date": string;
                    "p_reservation_time": string;
                    "p_whatsapp": string;
                };
                Returns: {
                    "id": string;
                }[];
            };
            "get_customer_reservations": {
                Args: {
                    "phone_param": string;
                };
                Returns: {
                    "arrived_at": string | null;
                    "birth_date": string | null;
                    "capacity_override_authorized_at": string | null;
                    "capacity_override_authorized_by": string | null;
                    "capacity_override_effect": NonNullable<Json>;
                    "capacity_override_reason": string | null;
                    "check_in_status": string | null;
                    "commercial_turn": string | null;
                    "completed_at": string | null;
                    "cpf": string | null;
                    "created_at": string;
                    "customer_id": string | null;
                    "decoration_id": string | null;
                    "decoration_service_starts_at": string | null;
                    "duracao_reserva_minutos": number | null;
                    "email": string | null;
                    "expires_at": string | null;
                    "id": string;
                    "intervalo_troca_minutos": number | null;
                    "location_id": string | null;
                    "name": string;
                    "notes": string | null;
                    "num_guests": number;
                    "payment_amount": number | null;
                    "payment_status": string | null;
                    "periodo_funcionamento_id": string | null;
                    "reservation_access_token_hash": string | null;
                    "reservation_date": string;
                    "reservation_time": string;
                    "schedule_override_authorized_at": string | null;
                    "schedule_override_authorized_by": string | null;
                    "schedule_override_reason": string | null;
                    "seated_at": string | null;
                    "service_starts_at": string | null;
                    "source": string;
                    "special_date_id": string | null;
                    "status": string | null;
                    "type": string | null;
                    "updated_at": string;
                    "whatsapp": string;
                }[];
                SetofOptions: {
                    from: "*";
                    to: "reservations";
                    isOneToOne: false;
                    isSetofReturn: true;
                };
            };
            "get_reservation_available_times": {
                Args: {
                    "p_from": string;
                    "p_to": string;
                };
                Returns: {
                    "reservation_date": string;
                    "reservation_time": string;
                }[];
            };
            "get_reservation_capacity_availability": {
                Args: {
                    "p_from": string;
                    "p_to": string;
                };
                Returns: {
                    "commercial_turn": string;
                    "has_unclassified_reservation": boolean;
                    "occupied_guests": number;
                    "reservation_date": string;
                    "reservation_time": string;
                    "service_starts_at": string;
                }[];
            };
            "get_reservation_commercial_turn": {
                Args: {
                    "p_reservation_date": string;
                    "p_reservation_time": string;
                };
                Returns: string;
            };
            "get_reservation_decoration_availability": {
                Args: {
                    "p_reservation_date": string;
                    "p_reservation_time": string;
                };
                Returns: {
                    "available": boolean;
                    "decoration_id": string;
                }[];
            };
            "get_reservation_occupancy_window": {
                Args: {
                    "p_reservation_id": string;
                };
                Returns: {
                    "ends_at": string;
                    "starts_at": string;
                }[];
            };
            "get_reservation_service_start_for_commercial_turn": {
                Args: {
                    "p_commercial_turn": string;
                    "p_reservation_date": string;
                };
                Returns: string;
            };
            "get_reservation_service_starts_at": {
                Args: {
                    "p_reservation_date": string;
                    "p_reservation_time": string;
                };
                Returns: string;
            };
            "get_reservation_table_availability": {
                Args: {
                    "p_reservation_id": string;
                };
                Returns: {
                    "active": boolean;
                    "area_id": string;
                    "area_name": string;
                    "available": boolean;
                    "max_capacity": number;
                    "min_capacity": number;
                    "reason": string;
                    "table_code": string;
                    "table_id": string;
                }[];
            };
            "get_reservation_with_access_token": {
                Args: {
                    "p_access_token_hash": string;
                    "p_reservation_id": string;
                };
                Returns: {
                    "id": string;
                    "num_guests": number;
                    "payment_amount": number;
                    "payment_status": string;
                    "reservation_date": string;
                    "reservation_time": string;
                    "status": string;
                }[];
            };
            "is_reservation_admin_or_owner": {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            "is_reservation_owner": {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            "release_expired_reservations": {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            "replace_reservation_table_assignments": {
                Args: {
                    "p_assigned_by"?: string;
                    "p_reservation_id": string;
                    "p_table_ids": (string)[];
                };
                Returns: {
                    "allocated_capacity": number;
                    "ends_at": string;
                    "id": string;
                    "starts_at": string;
                    "table_id": string;
                }[];
            };
            "reservation_commercial_turn_is_available": {
                Args: {
                    "p_commercial_turn": string;
                    "p_reservation_date": string;
                };
                Returns: boolean;
            };
            "reservation_service_start_is_available": {
                Args: {
                    "p_reservation_date": string;
                    "p_service_starts_at": string;
                };
                Returns: boolean;
            };
            "reservation_time_is_available": {
                Args: {
                    "p_reservation_date": string;
                    "p_reservation_time": string;
                };
                Returns: boolean;
            };
            "salvar_funcionamento_estabelecimento": {
                Args: {
                    "p_configuracao": Json;
                    "p_versao": number;
                };
                Returns: number;
            };
            "set_reservation_capacity_permission": {
                Args: {
                    "p_granted": boolean;
                    "p_profile_id": string;
                    "p_reason": string;
                };
                Returns: {
                    "granted": boolean;
                    "updated_profile_id": string;
                }[];
            };
            "transition_reservation_status": {
                Args: {
                    "p_expected_statuses": (string)[];
                    "p_next_status": string;
                    "p_reservation_id": string;
                };
                Returns: {
                    "id": string;
                    "status": string;
                }[];
            };
            "update_reservation_with_access_token": {
                Args: {
                    "p_access_token_hash": string;
                    "p_num_guests": number;
                    "p_reservation_date": string;
                    "p_reservation_id": string;
                    "p_reservation_time": string;
                };
                Returns: {
                    "id": string;
                    "num_guests": number;
                    "reservation_date": string;
                    "reservation_time": string;
                    "status": string;
                }[];
            };
            "update_reservation_with_authorized_overrides": {
                Args: {
                    "p_capacity_override_reason"?: string;
                    "p_commercial_turn"?: string;
                    "p_num_guests": number;
                    "p_reservation_date": string;
                    "p_reservation_id": string;
                    "p_reservation_time": string;
                    "p_schedule_override_reason"?: string;
                };
                Returns: {
                    "id": string;
                    "num_guests": number;
                    "reservation_date": string;
                    "reservation_time": string;
                }[];
            };
            "update_reservation_with_capacity_override": {
                Args: {
                    "p_num_guests": number;
                    "p_reason": string;
                    "p_reservation_date": string;
                    "p_reservation_id": string;
                    "p_reservation_time": string;
                };
                Returns: {
                    "id": string;
                    "num_guests": number;
                    "reservation_date": string;
                    "reservation_time": string;
                }[];
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export const Constants = {
    "public": {
        Enums: {}
    }
} as const;
