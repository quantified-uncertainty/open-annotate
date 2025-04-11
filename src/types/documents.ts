// Document type definitions
import type { DocumentReview } from "./documentReview";

export interface Document {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  publishedDate: string;
  reviews: DocumentReview[];
}

export interface DocumentsCollection {
  documents: Document[];
}
