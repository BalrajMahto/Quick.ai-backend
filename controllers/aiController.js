import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import { response } from "express";
import {v2 as cloudinary} from 'cloudinary';
import axios from "axios";
import FormData from "form-data";
import 'dotenv/config';
import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});


export const generateArticle = async (req, res) => {
    try {
        const {userId} = req.auth();
        const {prompt,length} = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage || 0;

        if(plan!== 'premium' && free_usage >= 10) {
            return res.json({success: false, message: 'You have reached your free usage limit.'});
        }

        const response = await AI.chat.completions.create({
    model: "gemini-2.0-flash",
    messages: [
        {
            role: "user",
            content: prompt,
        },
    ],
    temperature: 0.7,
    max_tokens: length,
});

    const content = response.choices[0].message.content;
    await sql ` INSERT INTO creations (user_id, prompt, content, type)
    VALUES (${userId}, ${prompt}, ${content}, 'article')`;

    if(plan !== 'premium') {
        await clerkClient.users.updateUserMetadata(userId, {
            privateMetadata: {
                free_usage: free_usage + 1
            }
        });
    }

    res.json({success: true, content});


    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: 'An error occurred while generating the article.'});

    }
}


export const generateBlogTitle = async (req, res) => {
    try {
        const {userId} = req.auth();
        const {prompt} = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage || 0;

        if(plan!== 'premium' && free_usage >= 10) {
            return res.json({success: false, message: 'You have reached your free usage limit.'});
        }

        const response = await AI.chat.completions.create({
    model: "gemini-2.0-flash",
    messages: [
        {
            role: "user",
            content: prompt,
        },
    ],
    temperature: 0.7,
    max_tokens: 100,
});

    const content = response.choices[0].message.content;
    await sql ` INSERT INTO creations (user_id, prompt, content, type)
    VALUES (${userId}, ${prompt}, ${content}, 'blog-title')`;

    if(plan !== 'premium') {
        await clerkClient.users.updateUserMetadata(userId, {
            privateMetadata: {
                free_usage: free_usage + 1
            }
        });
    }

    res.json({success: true, content});


    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: 'An error occurred while generating the title.'});

    }
}


export const generateImage = async (req, res) => {
    try {
        const {userId} = req.auth();
        const {prompt,publish} = req.body;
        const plan = req.plan;
 
        if(plan!== 'premium') {
            return res.json({success: false, message: 'You need a premium plan to generate images.'});
        }

        const formData = new FormData()
        formData.append('prompt', prompt)
        const {data} = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
            headers: {
                'x-api-key': process.env.CLIPDROP_API_KEY},
                responseType: 'arraybuffer',
            
        })

        const base64Image = `data:image/png;base64,${Buffer.from(data,'binary').toString('base64')}`;

       const {secure_url} = await cloudinary.uploader.upload(base64Image)
        

    await sql ` INSERT INTO creations (user_id, prompt, content, type,publish)
    VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`;

    
    res.json({success: true, content :secure_url});


    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: 'An error occurred while generating the Image.'});

    }
}

export const removeImageBackground = async (req, res) => {
    try {
        const {userId} = req.auth();
        const {image} = req.file;
        const plan = req.plan;
 
        if(plan!== 'premium') {
            return res.json({success: false, message: 'You need a premium plan to generate images.'});
        }




       const {secure_url} = await cloudinary.uploader.upload(image.path, {
        transformation: [
            {
                effect: 'background_removal',
                background_removal:'remove_the_background'
            }
        ]
       })
        

    await sql ` INSERT INTO creations (user_id, prompt, content, type)
    VALUES (${userId},'Remove background from image', ${secure_url}, 'image')`;

    
    res.json({success: true, content :secure_url});


    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: 'An error occurred while remove background Image.'});

    }
}


export const removeImageObject = async (req, res) => {
    try {
        const {userId} = req.auth();
        const {object} = req.body;
        const {image} = req.file;
        const plan = req.plan;
 
        if(plan!== 'premium') {
            return res.json({success: false, message: 'You need a premium plan to generate images.'});
        }

       const {public_id} = await cloudinary.uploader.upload(image.path)
       const imageUrl = cloudinary.url(public_id, {
        transformation: [
            {
                effect: `gen_remove:${object}`
            }
        ],
        resource_type: 'image'
       }) 
        
    await sql ` INSERT INTO creations (user_id, prompt, content, type)
    VALUES (${userId},${`Removed ${object} from image`} , ${imageUrl}, 'image')`;

    
    res.json({success: true, content :imageUrl});


    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: 'An error occurred while remove Object from Image.'});

    }
}

export const resumeReview = async (req, res) => {
    try {
        const {userId} = req.auth();
        const resume = req.file;
        const plan = req.plan;
 
        if(plan!== 'premium') {
            return res.json({success: false, message: 'You need a premium plan to generate images.'});
        }

      if(resume.size > 5 * 1024 * 1024) {
            return res.json({success: false, message: 'Resume file size exceeds the limit of 5MB.'});
        }

        const dataBuffer = fs.readFileSync(resume.path)
        const pdfData = await pdf(dataBuffer)

        const prompt = `Please review the following resume and provide feedback on its content, structure, and overall effectiveness. Resume Content:\n\n ${pdfData.text}`;

         const response = await AI.chat.completions.create({
                model: "gemini-2.0-flash",
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            });

    const content = response.choices[0].message.content;

        
    await sql ` INSERT INTO creations (user_id, prompt, content, type)
    VALUES (${userId},'Review th uploaded resume' , ${content}, 'resume-review')`;

    
    res.json({success: true, content});


    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: 'An error occurred while reviewing your resume.'});

    }
}