import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  name: String,               
  title: String,               
  fileName: String,            
  thumbnailFileName: String,   
  url: String,                 
  thumbnailUrl: String,        
  category: String,            
  secondaryCategory: String,   

  description: String,
  alt: String,

  tags: [String],
  keywords: [String],

  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Image", imageSchema);
