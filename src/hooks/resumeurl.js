import { useStaticQuery, graphql } from "gatsby";

export default function ResumeURL() {
  const resume = useStaticQuery(graphql`
    query {
      contentfulAsset(title: { eq: "resume" }) {
        file {
          url
        }
      }
    }
  `);

  return resume.contentfulAsset.file.url;
}
