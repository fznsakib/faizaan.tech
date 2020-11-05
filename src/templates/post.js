import React from "react";
import { graphql } from "gatsby";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";

import Head from "../components/head";
import ScrollableLayout from "../components/scrollablelayout";

import postStyles from "./post.module.scss";

export const query = graphql`
  query($slug: String!) {
    contentfulBlogPost(slug: { eq: $slug }) {
      title
      publishedDate(formatString: "Do MMMM YYYY")
      body {
        json
      }
    }
  }
`;

export default function Blog(props) {
  const options = {
    renderNode: {
      "embedded-asset-block": (node) => {
        const alt = node.data.target.fields.title["en-US"];
        const url = node.data.target.fields.file["en-US"].url;
        return <img alt={alt} src={url} />;
      },
    },
  };

  return (
    <ScrollableLayout>
      <Head title={props.data.contentfulBlogPost.title} />
      <h1 className={postStyles.header}>
        {props.data.contentfulBlogPost.title}
      </h1>
      <div>
        <p className={postStyles.date}>
          {props.data.contentfulBlogPost.publishedDate}
        </p>
        <div className={postStyles.divider}></div>
      </div>
      <div className={postStyles.content}>
        {documentToReactComponents(
          props.data.contentfulBlogPost.body.json,
          options
        )}
      </div>
    </ScrollableLayout>
  );
}
