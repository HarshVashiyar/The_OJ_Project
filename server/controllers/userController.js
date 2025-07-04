const User = require("../models/userDB");
const Submission = require("../models/submissionDB");

const handleCheckAuthStatus = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, isAuthenticated: false });
        }
        return res.status(200).json({ success: true, isAuthenticated: true });
    }
    catch (error) {
        console.error("Error checking authentication status:", error);
        return res.status(500).json({ success: false, isAuthenticated: false });
    }
}

const handleUserSignUp = async (req, res) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
        return res.status(400).json({ success: false, message: "Full name, email and password are required" });
    }
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User with the provided email already exists" });
        }
        const newUser = new User({ fullName, email, password });
        await newUser.save();
        return res.status(201).json({ success: true, message: "User created successfully" });
    }
    catch (error) {
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(", ") });
        }
        console.error("Error creating user:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleUserSignIn = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: "Email or Password is incorrect." });
        }
        const token = await User.matchPasswordAndGenerateToken(email, password);
        if (!token) {
            return res.status(401).json({ success: false, message: "Email or Password is incorrect." });
        }
        res.cookie("token", token, {
            httpOnly: true,
            //secure: process.env.NODE_ENV === "production",
            secure: true,
            sameSite: "none",
            maxAge: 24 * 60 * 60 * 1000
        });
        res.status(200).json({ success: true, message: 'Logged in successfully' });
    }
    catch (error) {
        console.error("Error signing in user:", error);
        if (error.statusCode === 401 || error.statusCode === 404) {
            return res.status(error.statusCode).json({ success: false, message: "Email or Password is incorrect." });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleGetAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        return res.status(200).json({
            success: true,
            users : users.map(user => ({
                fullName: user.fullName,
                role: user.role,
                email: user.email,
                dob: user.dob,
                pathToProfilePhoto: user.pathToProfilePhoto,
                numberOfProblemsSolved: user.numberOfProblemsSolved,
                problemsCreated: user.problemsCreated,
                submissions: user.submissions,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            }))
        });
    }
    catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleGetUserById = async (req, res) => {
    const { id } = req.user;
    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.status(200).json({
            success: true,
            user : {
                fullName: user.fullName,
                role: user.role,
                email: user.email,
                dob: user.dob,
                pathToProfilePhoto: user.pathToProfilePhoto,
                numberOfProblemsSolved: user.numberOfProblemsSolved,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                numberOfProblemsCreated: user.problemsCreated.length,
                numberOfSubmissions: user.submissions.length
            }
        });
    }
    catch (error) {
        console.error("Error fetching user:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleUpdateUser = async (req, res) => {
    const { id } = req.user;
    const { fullName, email, password, dob, pathToProfilePhoto, numberOfProblemsSolved, problemsCreated, submissions } = req.body;
    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        user.fullName = fullName || user.fullName;
        user.email = email || user.email;
        user.password = password || user.password;
        user.dob = dob || user.dob;
        user.pathToProfilePhoto = pathToProfilePhoto || user.pathToProfilePhoto;
        user.numberOfProblemsSolved = numberOfProblemsSolved || user.numberOfProblemsSolved;
        user.problemsCreated = problemsCreated || user.problemsCreated;
        user.submissions = submissions || user.submissions;
        await user.save();
        return res.status(200).json({ success: true, message: "User updated successfully" });
    }
    catch (error) {
        console.error("Error updating user:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleDeleteUser = async (req, res) => {
    const { id } = req.user;
    try {
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.status(200).json({ success: true, message: "User deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting user:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleLogout = async (req, res) => {
    try {
        res.clearCookie("token");
        return res.status(200).json({ success: true, message: "Logged out successfully" });
    }
    catch (error) {
        console.error("Error logging out user:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const handleViewSubmissions = async (req, res) => {
    const { id } = req.user;
    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const submissions = await Submission.find({ user: id })
            .populate({
                path: 'problem',
                select: 'name difficulty',
            })
            .sort({ createdAt: -1 })
            .lean();

        const formattedSubmissions = submissions.map(submission => ({
            // _id: submission._id,
            createdAt: submission.createdAt,
            problemName: submission.problem?.name || 'Unknown Problem',
            code: submission.code,
            language: submission.language,
            verdict: submission.verdict,
            executionTime: submission.executionTime,
            memoryUsed: submission.memoryUsed || 0,
            score: submission.score,
            difficulty: submission.problem?.difficulty || 'Unknown',
            failedTestCase: submission.failedTestCase || 0
        }));

        return res.status(200).json({ 
            success: true, 
            submissions: formattedSubmissions 
        });
    }
    catch (error) {
        console.error("Error fetching submissions:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

module.exports = {
    handleCheckAuthStatus,
    handleUserSignUp,
    handleUserSignIn,
    handleGetAllUsers,
    handleGetUserById,
    handleUpdateUser,
    handleDeleteUser,
    handleLogout,
    handleViewSubmissions
};
