import type { MovieDetail, SearchResult } from '../../api/_tmdb'

export type { MovieDetail, SearchResult }
export type Phase = 'proposals' | 'voting' | 'closed'

export interface Member {
  id: string
  display_name: string
  avatar_url: string | null
  is_organizer: boolean
  active: boolean
  created_at: string
}

export type MemberRef = Pick<Member, 'id' | 'display_name' | 'avatar_url'>

/** Fila de `movies`: la ficha de TMDB guardada al proponer la película. */
export type Movie = MovieDetail

export interface Proposal {
  id: string
  round_id: string
  member_id: string
  tmdb_id: number
  pitch: string | null
  created_at: string
  movie: Movie
  member: MemberRef
}

export interface Round {
  id: string
  title: string
  meeting_at: string | null
  phase: Phase
  winner_proposal_id: string | null
  tie_broken: boolean
  created_by: string | null
  created_at: string
  closed_at: string | null
  winner: { id: string; tmdb_id: number; movie: Movie; member: { display_name: string } } | null
}

export interface Vote {
  proposal_id: string
  member_id: string
}
