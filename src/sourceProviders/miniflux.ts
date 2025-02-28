import { loadEnv } from "../utils.js";

const MINIFLUX_API_URL = loadEnv("MINIFLUX_API_URL");
const MINIFLUX_API_KEY = loadEnv("MINIFLUX_API_KEY");

const fetchWithMiniflux = async (path: string, options: RequestInit = {}): Promise<Response> => {
    const url = new URL(path, MINIFLUX_API_URL);
    options.headers = {
        "X-Auth-Token": MINIFLUX_API_KEY,
    };
    return fetch(url.toString(), options);
}

export type MinifluxFeed = {
    id: number;
    user_id: number;
    title: string;
    site_url: string;
    feed_url: string;
    checked_at: string;
    etag_header: string;
    last_modified_header: string;
    parsing_error_message: string;
    parsing_error_count: number;
    scraper_rules: string;
    rewrite_rules: string;
    crawler: boolean;
    blocklist_rules: string;
    keeplist_rules: string;
    user_agent: string;
    username: string;
    password: string;
    disabled: boolean;
    ignore_http_cache: boolean;
    fetch_via_proxy: boolean;
    category: {
        id: number;
        user_id: number;
        title: string;
    };
    icon: {
        feed_id: number;
        icon_id: number;
    } | null;
}

export type MinifluxFeedEntry = {
    id: number;
    user_id: number;
    feed_id: number;
    title: string;
    url: string;
    comments_url: string;
    author: string;
    content: string;
    hash: string;
    published_at: string;
    created_at: string;
    changed_at: string;
    status: string;
    share_code: string;
    starred: boolean;
    reading_time: number;
    enclosures: null;
    feed: MinifluxFeed;
}


// https://miniflux.app/docs/api.html#endpoint-get-feeds
const GET_FEEDS_PATH = "/v1/feeds";
export const readMinifluxFeeds = async (): Promise<MinifluxFeed[]> => {
    const response = await fetchWithMiniflux(GET_FEEDS_PATH);
    return response.json();
}

// https://miniflux.app/docs/api.html#endpoint-flush-history
const FLUSH_HISTORY_PATH = "/v1/flush-history";
export const flushMinifluxHistory = async (): Promise<void> => {
    const response = await fetchWithMiniflux(FLUSH_HISTORY_PATH, { method: "POST" });
    if (!response.ok) {
        throw new Error(`Failed to flush history: ${response.statusText}`);
    }
    return;
}

export type ReadMinifluxEntriesResponse = {
    total: number;
    entries: MinifluxFeedEntry[];
}

type UnixTimestamp = number;
export type ReadMinifluxEntriesOptions = {
    status?: "read" | "unread" | "removed";
    offset?: number;
    limit?: number;
    order?: "id" | "status" | "published_at" | "category_title" | "category_id";
    direction?: "asc" | "desc";
    before?: UnixTimestamp;
    after?: UnixTimestamp;
    published_before?: UnixTimestamp;
    published_after?: UnixTimestamp;
    changed_before?: UnixTimestamp;
    changed_after?: UnixTimestamp;
    before_entry_id?: number;
    after_entry_id?: number;
    starred?: boolean;
    search?: string;
    category_id?: number;
}

const GET_ENTRIES_PATH = "/v1/entries";
export const readMinifluxEntries = async (options: ReadMinifluxEntriesOptions = {}): Promise<ReadMinifluxEntriesResponse> => {
    const params = new URLSearchParams(options as Record<string, string>);
    console.log(params.toString());
    const response = await fetchWithMiniflux(`${GET_ENTRIES_PATH}?${params.toString()}`);
    return response.json();
}
