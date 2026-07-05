const passport = require('passport');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;

console.log({
  GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: !!process.env.GOOGLE_CALLBACK_URL
});

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_CALLBACK_URL) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  const { connectToDatabase } = require('./db');

  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const { db } = await connectToDatabase();
      const users = db.collection('users');

      let user = await users.findOne({ googleId: profile.id });
      if (user) {
        return done(null, user);
      }

      const email = profile.emails?.[0]?.value;
      if (email) {
        user = await users.findOne({ email });
        if (user) {
          await users.updateOne(
            { _id: user._id },
            { $set: { googleId: profile.id, updatedAt: new Date() } }
          );
          user.googleId = profile.id;
          return done(null, user);
        }
      }

      const newUser = {
        googleId: profile.id,
        email: email || `google_${profile.id}@placeholder.com`,
        username: profile.displayName || `User${profile.id}`,
        avatar: profile.photos?.[0]?.value || '',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await users.insertOne(newUser);
      newUser._id = result.insertedId;

      return done(null, newUser);
    } catch (err) {
      return done(err, null);
    }
  }));

  console.log('Google OAuth strategy initialized.');
} else {
  console.warn('Google OAuth not configured: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL must be set.');
}

module.exports = passport;
