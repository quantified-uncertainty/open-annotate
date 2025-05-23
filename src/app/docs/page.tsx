"use client";

import { useState } from "react";

import Link from "next/link";

import { evaluationAgents } from "@/data/agents";
import { documentsCollection } from "@/data/docs";
import {
  getGradeColorStrong,
  getLetterGrade,
  getValidCommentCount,
} from "@/utils/commentUtils";
import {
  ChatBubbleLeftIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";

const WORD_COUNT_LEVELS = [
  { threshold: 1000, color: "text-gray-400" },
  { threshold: 5000, color: "text-gray-500" },
  { threshold: 20000, color: "text-gray-600" },
  { threshold: Infinity, color: "text-gray-700" },
] as const;

function getWordCountInfo(content: string) {
  const wordCount = content.split(/\s+/).length;
  const level = WORD_COUNT_LEVELS.findIndex(
    ({ threshold }) => wordCount < threshold
  );
  return {
    level,
    color: WORD_COUNT_LEVELS[level].color,
    wordCount,
  };
}

function WordCountIndicator({ content }: { content: string }) {
  const { level } = getWordCountInfo(content);
  const bars = Array.from({ length: level }, (_, i) => (
    <div
      key={i}
      className="w-0.5 bg-gray-500"
      style={{ height: `${(i + 1) * 3}px` }}
    />
  ));

  return <div className="flex items-end gap-0.5">{bars}</div>;
}

export default function DocumentsPage() {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");

  // Get unique evaluator names from all documents
  const evaluators = Array.from(
    new Set(
      documentsCollection.documents
        .flatMap(
          (doc) =>
            doc.reviews?.map((review) => {
              const agent = evaluationAgents.find(
                (a) => a.id === review.agentId
              );
              return agent?.name;
            }) || []
        )
        .filter(Boolean)
    )
  );

  // Filter documents based on search query
  const filteredDocuments = documentsCollection.documents.filter((document) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // Check title, author, and platforms
    if (
      document.title.toLowerCase().includes(query) ||
      document.author.toLowerCase().includes(query) ||
      document.platforms?.some((platform) =>
        platform.toLowerCase().includes(query)
      )
    ) {
      return true;
    }

    // Check if any agent name matches
    return document.reviews?.some((review) => {
      const agent = evaluationAgents.find((a) => a.id === review.agentId);
      return agent?.name.toLowerCase().includes(query);
    });
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Search and View Toggle - Keep in container */}
      <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="relative w-full max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, platform, or agent name..."
                className="block w-full rounded-md border-0 py-2 pl-10 text-gray-900 ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 focus:ring-inset sm:text-sm sm:leading-6"
              />
            </div>
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                  viewMode === "cards"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Squares2X2Icon className="h-5 w-5" />
                Card View
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                  viewMode === "table"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <TableCellsIcon className="h-5 w-5" />
                Table View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      {viewMode === "cards" ? (
        // Card View - Keep in container
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((document) => {
                // Count reviews by agent
                const agentReviews =
                  document.reviews?.reduce(
                    (acc, review) => {
                      acc[review.agentId] =
                        (acc[review.agentId] || 0) +
                        getValidCommentCount(review.comments || []);
                      return acc;
                    },
                    {} as Record<string, number>
                  ) || {};

                return (
                  <Link
                    key={document.id}
                    href={`/docs/${document.slug}`}
                    className="rounded-lg border border-gray-200 p-4 transition-colors duration-150 hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base leading-7 font-semibold text-gray-900">
                        {document.title}
                      </h2>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <div>{document.author}</div>
                        <div className="text-gray-300">•</div>
                        <div>
                          {new Date(document.publishedDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </div>
                        <div className="text-gray-300">•</div>
                        <div className="flex items-center gap-1">
                          <WordCountIndicator content={document.content} />
                          <span
                            className={getWordCountInfo(document.content).color}
                          >
                            {(() => {
                              const { wordCount } = getWordCountInfo(
                                document.content
                              );
                              if (wordCount >= 1000) {
                                return `${(wordCount / 1000).toFixed(1)}k words`;
                              }
                              return `${wordCount} words`;
                            })()}
                          </span>
                        </div>
                      </div>
                      {document.url && (
                        <div className="mt-1 flex items-center gap-2 truncate text-xs">
                          <span
                            className="cursor-pointer text-blue-400 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                document.url,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }}
                          >
                            {(() => {
                              try {
                                const url = new URL(document.url);
                                const path = url.pathname.split("/")[1];
                                return `${url.hostname}${path ? `/${path}...` : ""}`;
                              } catch {
                                return document.url;
                              }
                            })()}
                          </span>
                          {document.platforms &&
                            document.platforms.length > 0 && (
                              <>
                                <div className="text-gray-300">•</div>
                                <div className="flex items-center gap-2">
                                  {document.platforms.map((platform) => (
                                    <span
                                      key={platform}
                                      className="inline-flex items-center text-xs font-medium text-blue-500"
                                    >
                                      {platform}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {Object.entries(agentReviews).map(
                          ([agentId, commentCount]) => {
                            const agent = evaluationAgents.find(
                              (a) => a.id === agentId
                            );
                            const hasGradeInstructions =
                              agent?.gradeInstructions;
                            const grade = document.reviews.find(
                              (r) => r.agentId === agentId
                            )?.grade;

                            return (
                              <div
                                key={agentId}
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                              >
                                {agent?.name}
                                {hasGradeInstructions &&
                                  grade !== undefined && (
                                    <span
                                      className={`ml-1 rounded-sm px-1.5 ${getGradeColorStrong(grade).className}`}
                                      style={getGradeColorStrong(grade).style}
                                    >
                                      {getLetterGrade(grade)}
                                    </span>
                                  )}
                                <ChatBubbleLeftIcon className="ml-2 h-3 w-3 text-gray-400" />{" "}
                                <span className="text-gray-500">
                                  {commentCount}
                                </span>
                              </div>
                            );
                          }
                        )}
                        {document.reviews?.length === 0 && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                            No reviews yet
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Table View - Full width
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px] px-8">
              {" "}
              {/* Minimum width to prevent squishing */}
              <table className="w-full divide-y divide-gray-200 rounded-lg border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="max-w-[300px] border-b border-gray-200 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                      Title
                    </th>
                    <th
                      scope="col"
                      className="w-32 border-b border-gray-200 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                      Author
                    </th>
                    <th
                      scope="col"
                      className="w-32 border-b border-gray-200 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="w-48 border-b border-gray-200 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                      Platforms
                    </th>
                    <th
                      scope="col"
                      className="w-32 border-b border-gray-200 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                    >
                      Length
                    </th>
                    {evaluators.map((evaluator) => (
                      <th
                        key={evaluator}
                        scope="col"
                        className="border-b border-gray-200 px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        {evaluator}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredDocuments.map((document) => (
                    <tr key={document.id} className="hover:bg-gray-50">
                      <td className="max-w-[300px] border-b border-gray-200 px-4 py-4 whitespace-nowrap">
                        <Link
                          href={`/docs/${document.slug}`}
                          className="block truncate text-blue-600 hover:text-blue-900"
                        >
                          {document.title}
                        </Link>
                      </td>
                      <td className="w-32 border-b border-gray-200 px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                        {document.author}
                      </td>
                      <td className="w-32 border-b border-gray-200 px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                        {new Date(document.publishedDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </td>
                      <td className="w-48 border-b border-gray-200 px-6 py-4 text-sm whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          {document.platforms?.map((platform) => (
                            <span
                              key={platform}
                              className="inline-flex items-center text-xs font-medium text-blue-500"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="w-32 border-b border-gray-200 px-6 py-4 text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <WordCountIndicator content={document.content} />
                          <span
                            className={getWordCountInfo(document.content).color}
                          >
                            {(() => {
                              const { wordCount } = getWordCountInfo(
                                document.content
                              );
                              if (wordCount >= 1000) {
                                return `${(wordCount / 1000).toFixed(1)}k`;
                              }
                              return `${wordCount}`;
                            })()}
                          </span>
                        </div>
                      </td>
                      {evaluators.map((evaluator) => {
                        const review = document.reviews?.find(
                          (r) =>
                            evaluationAgents.find((a) => a.id === r.agentId)
                              ?.name === evaluator
                        );
                        return (
                          <td
                            key={evaluator}
                            className="border-b border-gray-200 px-6 py-4 text-sm whitespace-nowrap"
                          >
                            {review?.grade !== undefined && (
                              <span
                                className={`rounded-sm px-1.5 text-xs font-medium ${getGradeColorStrong(review.grade).className}`}
                                style={getGradeColorStrong(review.grade).style}
                              >
                                {getLetterGrade(review.grade)}
                              </span>
                            )}
                            {review && (
                              <span className="ml-2 text-gray-500">
                                <ChatBubbleLeftIcon className="inline h-3 w-3 text-gray-400" />
                                <span className="ml-1">
                                  {getValidCommentCount(review.comments || [])}
                                </span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
