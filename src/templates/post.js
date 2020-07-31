import React from 'react'
import Layout from "../components/layout"
import Head from "../components/head"
import { graphql } from 'gatsby'
import { documentToReactComponents } from '@contentful/rich-text-react-renderer'

// export const query = graphql`
//   query($slug: String!) {
//     markdownRemark(fields: { slug: { eq: $slug } }) {
//       frontmatter {
//         title
//         date
//       }
//       html
//     }
//   }
// `

export const query = graphql`
  query($slug: String!) {
    contentfulBlogPost(slug: {eq: $slug}) {
      title
      publishedDate(formatString: "Do MMMM YYYY")
      body {
        json
      }
    }
  }
`

export default function Blog(props) {
  const options = {
    renderNode: {
      "embedded-asset-block": (node) => {
        const alt = node.data.target.fields.title['en-US']
        const url = node.data.target.fields.file['en-US'].url
        return <img alt={alt} src={url} />
      }
    }
  }

  // const RenderPostHTML = (props) => (<div dangerouslySetInnerHTML={{ __html: props.html }}></div>)

  return (
    <Layout>
      <Head title={props.data.contentfulBlogPost.title}/>
      <h1>{ props.data.contentfulBlogPost.title }</h1>
      <p>{ props.data.contentfulBlogPost.publishedDate }</p>
      {documentToReactComponents(props.data.contentfulBlogPost.body.json, options)}
      {/* <RenderPostHTML html={props.data.contentfulBlogPost.html}/> */}
    </Layout>
  )
}