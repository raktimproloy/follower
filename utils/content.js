/**
 * Extract hashtags from content
 * @param {string} content - Post content
 * @returns {string[]} Array of hashtags
 */
const extractHashtags = (content) => {
  const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
  const hashtags = content.match(hashtagRegex) || [];
  return hashtags.map(tag => tag.toLowerCase());
};

/**
 * Extract mentions from content
 * @param {string} content - Post content
 * @returns {string[]} Array of usernames mentioned
 */
const extractMentions = (content) => {
  const mentionRegex = /@[\w\u0590-\u05ff]+/g;
  const mentions = content.match(mentionRegex) || [];
  return mentions.map(mention => mention.substring(1)); // Remove @ symbol
};

/**
 * Process post content to extract hashtags and mentions
 * @param {string} content - Post content
 * @returns {object} Object containing hashtags and mentions
 */
const processContent = (content) => {
  return {
    hashtags: extractHashtags(content),
    mentions: extractMentions(content)
  };
};

/**
 * Validate content length and characters
 * @param {string} content - Post content
 * @returns {object} Validation result
 */
const validateContent = (content) => {
  if (!content || content.trim().length === 0) {
    return {
      isValid: false,
      message: 'Content cannot be empty'
    };
  }

  if (content.length > 2000) {
    return {
      isValid: false,
      message: 'Content must be less than 2000 characters'
    };
  }

  return {
    isValid: true,
    message: 'Content is valid'
  };
};

module.exports = {
  extractHashtags,
  extractMentions,
  processContent,
  validateContent
};
